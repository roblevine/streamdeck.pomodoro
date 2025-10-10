/**
 * Plugin Message Observer
 *
 * Handles incoming messages from Property Inspector using an observable pattern.
 * Integrates with Stream Deck logger for debug visibility.
 */
import streamDeck from "@elgato/streamdeck";
import { Message, PropertyInspectorMessage } from "../types/messages";

type MessageHandler = (context: string, message: PropertyInspectorMessage) => void | Promise<void>;

export class PluginMessageObserver {
	private handlers: Map<string, MessageHandler[]>;
	private debugMode: boolean;

    constructor(debugMode = false) {
        this.handlers = new Map();
        this.debugMode = debugMode;
        this.log('PluginMessageObserver initialized');
    }

	/**
	 * Register a handler for a specific message type
	 */
	registerHandler(messageType: string, handler: MessageHandler): void {
		if (!this.handlers.has(messageType)) {
			this.handlers.set(messageType, []);
		}

		this.handlers.get(messageType)!.push(handler);
		this.log(`Handler registered for: ${messageType} (total: ${this.handlers.get(messageType)!.length})`);
	}

	/**
	 * Handle incoming message from Property Inspector
	 */
	async handleMessage(context: string, payload: PropertyInspectorMessage): Promise<void> {
		this.log(`Received message: ${payload.type}`, payload.payload);

		const handlers = this.handlers.get(payload.type);
		if (handlers && handlers.length > 0) {
			this.log(`Dispatching to ${handlers.length} handler(s)`);

			// Execute all handlers for this message type
			for (const handler of handlers) {
				try {
					await handler(context, payload);
				} catch (error) {
					streamDeck.logger.error(`[PluginMessageObserver] Handler error for ${payload.type}:`, error);
				}
			}
		} else {
			this.log(`No handlers registered for: ${payload.type}`);
		}
	}

	/**
	 * Send message to Property Inspector
	 */
	sendToPropertyInspector(context: string, message: Message): void {
		this.log(`Sending to PI: ${message.type}`, message.payload);

		// Use Stream Deck SDK to send message to current property inspector
		// Cast to any to satisfy JsonValue type requirement
		streamDeck.ui.current?.sendToPropertyInspector(message as any);
	}

	/**
	 * Get statistics about registered handlers
	 */
	getStats(): { messageTypes: string[]; totalHandlers: number } {
		const stats = {
			messageTypes: Array.from(this.handlers.keys()),
			totalHandlers: 0
		};

		this.handlers.forEach((handlers) => {
			stats.totalHandlers += handlers.length;
		});

		return stats;
	}

	/**
	 * Debug logging using Stream Deck logger
	 */
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
