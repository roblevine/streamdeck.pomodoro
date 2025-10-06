# Property Inspector Message Observer Pattern

**Plan Number:** 0003
**Status:** Planned
**Date:** 2025-10-06

## Overview

Introduce a message observer/publish-subscribe pattern to the Property Inspector for cleaner separation of concerns and better debugging. This will decouple UI event handling from message sending logic and integrate with Stream Deck's logging infrastructure for comprehensive debug visibility.

## Goals

1. **Separation of Concerns**: Decouple UI events from message handling logic
2. **Observable Pattern**: Implement pub/sub for message routing
3. **Debug Visibility**: Integrate Stream Deck logger to see all message flows
4. **Type Safety**: Strongly-typed message definitions and handlers
5. **Easy Extension**: Simple to add new message types and subscribers

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Property Inspector (Browser)                │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          PropertyInspectorMessageBus                    │  │
│  │  - publish(message)                                     │  │
│  │  - subscribe(messageType, handler)                      │  │
│  │  - unsubscribe(subscriptionId)                          │  │
│  │  - sendToPlugin(message)                                │  │
│  │  - Debug logging to console                             │  │
│  └────────────────────────────────────────────────────────┘  │
│           ↑                    ↑                              │
│           │                    │                              │
│  ┌────────┴─────┐    ┌────────┴────────┐                     │
│  │ UI Events    │    │ WebSocket       │                     │
│  │ - clicks     │    │ Messages        │                     │
│  │ - changes    │    │ from Plugin     │                     │
│  └──────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Plugin (Node.js)                        │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           PluginMessageObserver                         │  │
│  │  - handleMessage(payload)                               │  │
│  │  - registerHandler(messageType, handler)                │  │
│  │  - sendToPropertyInspector(message)                     │  │
│  │  - Uses streamDeck.logger for debug output              │  │
│  └────────────────────────────────────────────────────────┘  │
│           ↓                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Message Handlers                                       │  │
│  │  - PreviewSoundHandler                                  │  │
│  │  - StopSoundHandler                                     │  │
│  │  - (future handlers...)                                 │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Message Flow

### Example: Preview Sound Click

```
1. User clicks "Preview" button
   ↓
2. UI event triggers message publication
   ↓
3. PropertyInspectorMessageBus.publish({
     type: 'previewSound',
     payload: { filePath: '...', playbackId: 'work-preview' }
   })
   ↓
4. Debug log: "[PI MessageBus] Publishing: previewSound"
   ↓
5. Subscribers notified (if any local handlers exist)
   ↓
6. Message sent to plugin via WebSocket
   ↓
7. Plugin receives in onSendToPlugin()
   ↓
8. PluginMessageObserver.handleMessage(payload)
   ↓
9. streamDeck.logger.debug("[PluginMessageObserver] Received: previewSound")
   ↓
10. Route to PreviewSoundHandler
    ↓
11. streamDeck.logger.debug("[PreviewSoundHandler] Playing: work-preview")
    ↓
12. AudioPlayer.play() executes
    ↓
13. Send confirmation back to PI (optional)
    ↓
14. PropertyInspectorMessageBus receives confirmation
    ↓
15. Debug log: "[PI MessageBus] Received from plugin: playbackStarted"
```

## Implementation Plan

### Phase 1: Type Definitions

**File:** `src/types/messages.ts` (new)

Define all message types and payloads:

```typescript
// Base message structure
export interface Message<T = unknown> {
    type: string;
    payload: T;
}

// PI → Plugin messages
export interface PreviewSoundMessage {
    type: 'previewSound';
    payload: {
        filePath: string;
        playbackId: string;
    };
}

export interface StopSoundMessage {
    type: 'stopSound';
    payload: {
        playbackId: string;
    };
}

// Plugin → PI messages
export interface PlaybackStartedMessage {
    type: 'playbackStarted';
    payload: {
        playbackId: string;
    };
}

export interface PlaybackStoppedMessage {
    type: 'playbackStopped';
    payload: {
        playbackId: string;
    };
}

// Union types
export type PropertyInspectorMessage =
    | PreviewSoundMessage
    | StopSoundMessage;

export type PluginMessage =
    | PlaybackStartedMessage
    | PlaybackStoppedMessage;
```

### Phase 2: Property Inspector Message Bus

**File:** `ui/pi-message-bus.ts` (new)

Browser-side message bus with console logging:

```typescript
export class PropertyInspectorMessageBus {
    private subscriptions: Map<string, Set<MessageHandler>>;
    private websocket: WebSocket | null;
    private pluginUUID: string | null;
    private debugMode: boolean;

    constructor(debugMode = true) {
        this.subscriptions = new Map();
        this.websocket = null;
        this.pluginUUID = null;
        this.debugMode = debugMode;
    }

    // Initialize WebSocket connection
    init(port: number, uuid: string): void {
        this.pluginUUID = uuid;
        this.websocket = new WebSocket(`ws://127.0.0.1:${port}`);

        this.websocket.onopen = () => {
            this.log('WebSocket connected');
            this.registerWithStreamDeck();
        };

        this.websocket.onmessage = (evt) => {
            this.handleIncomingMessage(evt);
        };
    }

    // Subscribe to message type
    subscribe(messageType: string, handler: MessageHandler): string {
        const subscriptionId = this.generateSubscriptionId();

        if (!this.subscriptions.has(messageType)) {
            this.subscriptions.set(messageType, new Set());
        }

        this.subscriptions.get(messageType)!.add(handler);
        this.log(`Subscribed to '${messageType}' (id: ${subscriptionId})`);

        return subscriptionId;
    }

    // Unsubscribe
    unsubscribe(subscriptionId: string): void {
        // Implementation: remove handler from subscriptions
        this.log(`Unsubscribed: ${subscriptionId}`);
    }

    // Publish message locally and/or to plugin
    publish(message: Message, sendToPlugin = true): void {
        this.log(`Publishing: ${message.type}`, message.payload);

        // Notify local subscribers
        const handlers = this.subscriptions.get(message.type);
        if (handlers) {
            handlers.forEach(handler => handler(message));
        }

        // Send to plugin if requested
        if (sendToPlugin && this.websocket) {
            this.sendToPlugin(message);
        }
    }

    // Send message to plugin
    private sendToPlugin(message: Message): void {
        if (this.websocket?.readyState === WebSocket.OPEN && this.pluginUUID) {
            const json = {
                event: 'sendToPlugin',
                context: this.pluginUUID,
                payload: message
            };
            this.websocket.send(JSON.stringify(json));
            this.log(`Sent to plugin: ${message.type}`);
        }
    }

    // Handle incoming messages from plugin
    private handleIncomingMessage(evt: MessageEvent): void {
        const data = JSON.parse(evt.data);

        if (data.event === 'sendToPropertyInspector') {
            const message = data.payload as Message;
            this.log(`Received from plugin: ${message.type}`, message.payload);

            // Notify subscribers
            const handlers = this.subscriptions.get(message.type);
            if (handlers) {
                handlers.forEach(handler => handler(message));
            }
        }
    }

    // Debug logging
    private log(message: string, data?: unknown): void {
        if (this.debugMode) {
            console.log(`[PI MessageBus] ${message}`, data || '');
        }
    }

    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private registerWithStreamDeck(): void {
        if (this.websocket && this.pluginUUID) {
            const json = {
                event: 'registerPropertyInspector',
                uuid: this.pluginUUID
            };
            this.websocket.send(JSON.stringify(json));
        }
    }
}

type MessageHandler = (message: Message) => void;
```

### Phase 3: Plugin Message Observer

**File:** `src/lib/plugin-message-observer.ts` (new)

Plugin-side message handler with Stream Deck logger integration:

```typescript
import streamDeck from "@elgato/streamdeck";
import { Message, PropertyInspectorMessage } from "../types/messages";

export class PluginMessageObserver {
    private handlers: Map<string, MessageHandler[]>;
    private debugMode: boolean;

    constructor(debugMode = true) {
        this.handlers = new Map();
        this.debugMode = debugMode;
    }

    // Register a handler for a specific message type
    registerHandler(messageType: string, handler: MessageHandler): void {
        if (!this.handlers.has(messageType)) {
            this.handlers.set(messageType, []);
        }

        this.handlers.get(messageType)!.push(handler);
        this.log(`Handler registered for: ${messageType}`);
    }

    // Handle incoming message from Property Inspector
    handleMessage(context: string, payload: PropertyInspectorMessage): void {
        this.log(`Received message: ${payload.type}`, payload.payload);

        const handlers = this.handlers.get(payload.type);
        if (handlers && handlers.length > 0) {
            this.log(`Dispatching to ${handlers.length} handler(s)`);
            handlers.forEach(handler => {
                try {
                    handler(context, payload);
                } catch (error) {
                    streamDeck.logger.error(`Handler error for ${payload.type}:`, error);
                }
            });
        } else {
            this.log(`No handlers registered for: ${payload.type}`);
        }
    }

    // Send message to Property Inspector
    sendToPropertyInspector(context: string, message: Message): void {
        this.log(`Sending to PI: ${message.type}`, message.payload);

        // Use Stream Deck SDK to send message
        streamDeck.send({
            event: 'sendToPropertyInspector',
            context,
            payload: message
        });
    }

    // Debug logging using Stream Deck logger
    private log(message: string, data?: unknown): void {
        if (this.debugMode) {
            if (data !== undefined) {
                streamDeck.logger.debug(`[PluginMessageObserver] ${message}`, data);
            } else {
                streamDeck.logger.debug(`[PluginMessageObserver] ${message}`);
            }
        }
    }
}

type MessageHandler = (context: string, message: Message) => void;
```

### Phase 4: Message Handlers

**File:** `src/lib/message-handlers/preview-sound-handler.ts` (new)

```typescript
import streamDeck from "@elgato/streamdeck";
import { AudioPlayer } from "../audio-player";
import { PreviewSoundMessage, PlaybackStartedMessage } from "../../types/messages";

export async function handlePreviewSound(
    context: string,
    message: PreviewSoundMessage,
    messageObserver: PluginMessageObserver
): Promise<void> {
    const { filePath, playbackId } = message.payload;

    streamDeck.logger.debug(`[PreviewSoundHandler] Playing: ${playbackId}, file: ${filePath}`);

    try {
        await AudioPlayer.play(filePath, playbackId);

        // Notify PI that playback started
        const response: PlaybackStartedMessage = {
            type: 'playbackStarted',
            payload: { playbackId }
        };
        messageObserver.sendToPropertyInspector(context, response);

        streamDeck.logger.debug(`[PreviewSoundHandler] Playback started: ${playbackId}`);
    } catch (error) {
        streamDeck.logger.error(`[PreviewSoundHandler] Failed to play sound:`, error);
    }
}
```

**File:** `src/lib/message-handlers/stop-sound-handler.ts` (new)

```typescript
import streamDeck from "@elgato/streamdeck";
import { AudioPlayer } from "../audio-player";
import { StopSoundMessage, PlaybackStoppedMessage } from "../../types/messages";

export function handleStopSound(
    context: string,
    message: StopSoundMessage,
    messageObserver: PluginMessageObserver
): void {
    const { playbackId } = message.payload;

    streamDeck.logger.debug(`[StopSoundHandler] Stopping: ${playbackId}`);

    try {
        AudioPlayer.stop();

        // Notify PI that playback stopped
        const response: PlaybackStoppedMessage = {
            type: 'playbackStopped',
            payload: { playbackId }
        };
        messageObserver.sendToPropertyInspector(context, response);

        streamDeck.logger.debug(`[StopSoundHandler] Playback stopped: ${playbackId}`);
    } catch (error) {
        streamDeck.logger.error(`[StopSoundHandler] Failed to stop sound:`, error);
    }
}
```

### Phase 5: Integration

#### Update `pomodoro-timer.ts`

```typescript
import { PluginMessageObserver } from "../lib/plugin-message-observer";
import { handlePreviewSound } from "../lib/message-handlers/preview-sound-handler";
import { handleStopSound } from "../lib/message-handlers/stop-sound-handler";

@action({ UUID: "uk.co.roblevine.streamdeck.pomodoro.timer" })
export class PomodoroTimerAction extends SingletonAction<PomodoroSettings> {
    private messageObserver: PluginMessageObserver;

    constructor() {
        super();
        this.messageObserver = new PluginMessageObserver(true); // debug mode ON

        // Register handlers
        this.messageObserver.registerHandler('previewSound', (ctx, msg) =>
            handlePreviewSound(ctx, msg, this.messageObserver)
        );
        this.messageObserver.registerHandler('stopSound', (ctx, msg) =>
            handleStopSound(ctx, msg, this.messageObserver)
        );
    }

    override async onSendToPlugin(ev: SendToPluginEvent<unknown>): Promise<void> {
        // Delegate to message observer
        this.messageObserver.handleMessage(ev.action.id, ev.payload);
    }
}
```

#### Update Property Inspector HTML

```html
<script src="pi-message-bus.js"></script>
<script>
    // Global message bus instance
    let messageBus = null;

    // Initialize on connection
    window.connectElgatoStreamDeckSocket = function(inPort, inPluginUUID, inRegisterEvent, inInfo, inActionInfo) {
        messageBus = new PropertyInspectorMessageBus(true); // debug mode ON
        messageBus.init(inPort, inPluginUUID);

        // Subscribe to plugin responses
        messageBus.subscribe('playbackStarted', (msg) => {
            updateButtonState(msg.payload.playbackId, true);
        });

        messageBus.subscribe('playbackStopped', (msg) => {
            updateButtonState(msg.payload.playbackId, false);
        });
    };

    // Preview button click
    window.previewWorkSound = function() {
        if (playbackState.work) {
            // Stop
            messageBus.publish({
                type: 'stopSound',
                payload: { playbackId: 'work-preview' }
            });
        } else {
            // Play
            const filePath = document.getElementById('workSoundFile')?.value;
            if (filePath) {
                messageBus.publish({
                    type: 'previewSound',
                    payload: { filePath, playbackId: 'work-preview' }
                });
            }
        }
    };
</script>
```

## Debug Output Examples

### Property Inspector Console

```
[PI MessageBus] WebSocket connected
[PI MessageBus] Subscribed to 'playbackStarted' (id: sub_1696512345_a7b9c3)
[PI MessageBus] Subscribed to 'playbackStopped' (id: sub_1696512345_d4e2f1)
[PI MessageBus] Publishing: previewSound { filePath: '/path/to/work.wav', playbackId: 'work-preview' }
[PI MessageBus] Sent to plugin: previewSound
[PI MessageBus] Received from plugin: playbackStarted { playbackId: 'work-preview' }
```

### Plugin Stream Deck Logs

```
[DEBUG] [PluginMessageObserver] Handler registered for: previewSound
[DEBUG] [PluginMessageObserver] Handler registered for: stopSound
[DEBUG] [PluginMessageObserver] Received message: previewSound { filePath: '/path/to/work.wav', playbackId: 'work-preview' }
[DEBUG] [PluginMessageObserver] Dispatching to 1 handler(s)
[DEBUG] [PreviewSoundHandler] Playing: work-preview, file: /path/to/work.wav
[DEBUG] [PreviewSoundHandler] Playback started: work-preview
[DEBUG] [PluginMessageObserver] Sending to PI: playbackStarted { playbackId: 'work-preview' }
```

## Benefits

1. **Separation of Concerns**: UI code doesn't need to know about WebSocket details
2. **Type Safety**: All messages strongly typed with TypeScript
3. **Debuggability**: Complete visibility into message flows in both PI and plugin
4. **Extensibility**: Adding new message types is trivial
5. **Testability**: Message handlers can be unit tested independently
6. **Consistency**: All plugin/PI communication follows same pattern

## Future Enhancements

1. **Message validation**: JSON schema validation for payloads
2. **Request/response pattern**: Correlation IDs for async request/response
3. **Message replay**: Record and replay messages for debugging
4. **Performance metrics**: Track message processing times
5. **Error boundaries**: Graceful handling of message handler failures

## Testing Strategy

1. **Unit tests**: Test message bus in isolation
2. **Integration tests**: Test message flow between PI and plugin
3. **Manual testing**: Use debug logs to verify all message paths
4. **Load testing**: Verify performance with rapid message sending

## Rollout Plan

1. Implement Phase 1-3 (types, message bus, observer)
2. Migrate preview sound functionality to new pattern
3. Test thoroughly with debug logging
4. Once stable, migrate other PI features
5. Document pattern for future features

## Related Issues

- Fixes foundation for debugging stop button bug (plan 0002)
- Provides pattern for future PI features
- Improves maintainability of PI/plugin communication
