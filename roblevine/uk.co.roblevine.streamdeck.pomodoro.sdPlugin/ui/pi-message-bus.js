/**
 * Property Inspector Message Bus
 *
 * Observable pattern for Property Inspector messaging with debug logging.
 * Handles WebSocket communication with the plugin and local event subscriptions.
 */

class PropertyInspectorMessageBus {
	constructor(debugMode = true) {
		this.subscriptions = new Map();
		this.handlers = new Map();
		this.websocket = null;
		this.pluginUUID = null;
		this.debugMode = debugMode;
		this.subscriptionCounter = 0;
	}

	/**
	 * Initialize WebSocket connection to Stream Deck
	 */
	init(port, uuid) {
		this.pluginUUID = uuid;
		this.websocket = new WebSocket(`ws://127.0.0.1:${port}`);

		this.websocket.onopen = () => {
			this.log('WebSocket connected');
			this.registerWithStreamDeck();
		};

		this.websocket.onmessage = (evt) => {
			this.handleIncomingMessage(evt);
		};

		this.websocket.onerror = (error) => {
			this.log('WebSocket error', error);
		};

		this.websocket.onclose = () => {
			this.log('WebSocket disconnected');
		};
	}

	/**
	 * Subscribe to a specific message type
	 * @param {string} messageType - The message type to subscribe to
	 * @param {Function} handler - Callback function (message) => void
	 * @returns {string} Subscription ID for unsubscribing
	 */
	subscribe(messageType, handler) {
		const subscriptionId = `sub_${++this.subscriptionCounter}_${Date.now()}`;

		if (!this.handlers.has(messageType)) {
			this.handlers.set(messageType, new Map());
		}

		this.handlers.get(messageType).set(subscriptionId, handler);
		this.log(`Subscribed to '${messageType}' (id: ${subscriptionId})`);

		// Store reverse mapping for unsubscribe
		this.subscriptions.set(subscriptionId, { messageType, handler });

		return subscriptionId;
	}

	/**
	 * Unsubscribe from messages
	 * @param {string} subscriptionId - ID returned from subscribe()
	 */
	unsubscribe(subscriptionId) {
		const subscription = this.subscriptions.get(subscriptionId);
		if (subscription) {
			const { messageType } = subscription;
			const handlers = this.handlers.get(messageType);

			if (handlers) {
				handlers.delete(subscriptionId);
				this.log(`Unsubscribed from '${messageType}' (id: ${subscriptionId})`);

				// Clean up empty handler maps
				if (handlers.size === 0) {
					this.handlers.delete(messageType);
				}
			}

			this.subscriptions.delete(subscriptionId);
		}
	}

	/**
	 * Publish a message locally and/or to the plugin
	 * @param {Object} message - Message object with type and payload
	 * @param {boolean} sendToPlugin - Whether to send to plugin (default: true)
	 */
	publish(message, sendToPlugin = true) {
		this.log(`Publishing: ${message.type}`, message.payload);

		// Notify local subscribers
		const handlers = this.handlers.get(message.type);
		if (handlers) {
			this.log(`Notifying ${handlers.size} local subscriber(s)`);
			handlers.forEach((handler, id) => {
				try {
					handler(message);
				} catch (error) {
					console.error(`[PI MessageBus] Handler error for ${message.type}:`, error);
				}
			});
		}

		// Send to plugin if requested
		if (sendToPlugin) {
			this.sendToPlugin(message);
		}
	}

	/**
	 * Send message to plugin via WebSocket
	 * @private
	 */
	sendToPlugin(message) {
		if (this.websocket?.readyState === WebSocket.OPEN && this.pluginUUID) {
			const json = {
				event: 'sendToPlugin',
				context: this.pluginUUID,
				payload: message
			};
			this.websocket.send(JSON.stringify(json));
			this.log(`Sent to plugin: ${message.type}`);
		} else {
			this.log(`Cannot send to plugin: WebSocket not ready (state: ${this.websocket?.readyState})`);
		}
	}

	/**
	 * Handle incoming messages from plugin
	 * @private
	 */
	handleIncomingMessage(evt) {
		try {
			const data = JSON.parse(evt.data);

			if (data.event === 'sendToPropertyInspector') {
				const message = data.payload;
				this.log(`Received from plugin: ${message.type}`, message.payload);

				// Notify subscribers
				const handlers = this.handlers.get(message.type);
				if (handlers) {
					this.log(`Dispatching to ${handlers.size} handler(s)`);
					handlers.forEach((handler, id) => {
						try {
							handler(message);
						} catch (error) {
							console.error(`[PI MessageBus] Handler error for ${message.type}:`, error);
						}
					});
				} else {
					this.log(`No handlers registered for: ${message.type}`);
				}
			}
		} catch (error) {
			console.error('[PI MessageBus] Error parsing message:', error);
		}
	}

	/**
	 * Register this Property Inspector with Stream Deck
	 * @private
	 */
	registerWithStreamDeck() {
		if (this.websocket && this.pluginUUID) {
			const json = {
				event: 'registerPropertyInspector',
				uuid: this.pluginUUID
			};
			this.websocket.send(JSON.stringify(json));
			this.log('Registered with Stream Deck');
		}
	}

	/**
	 * Debug logging to console
	 * @private
	 */
	log(message, data) {
		if (this.debugMode) {
			if (data !== undefined) {
				console.log(`[PI MessageBus] ${message}`, data);
			} else {
				console.log(`[PI MessageBus] ${message}`);
			}
		}
	}

	/**
	 * Get statistics about current subscriptions
	 */
	getStats() {
		const stats = {
			totalSubscriptions: this.subscriptions.size,
			messageTypes: []
		};

		this.handlers.forEach((handlers, messageType) => {
			stats.messageTypes.push({
				type: messageType,
				subscriberCount: handlers.size
			});
		});

		return stats;
	}
}

// Export for use in HTML
if (typeof window !== 'undefined') {
	window.PropertyInspectorMessageBus = PropertyInspectorMessageBus;
}
