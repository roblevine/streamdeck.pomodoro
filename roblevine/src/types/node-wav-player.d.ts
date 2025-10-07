declare module 'node-wav-player' {
	export interface PlayOptions {
		path: string;
		sync?: boolean;
	}

	export function play(options: PlayOptions): Promise<void>;
	export function stop(): void;
}
