/**
 * DirectorEventBus - Director Mode 事件總線
 * 
 * 解耦 SceneViewer 和 Director 之間的通訊
 */

import type { TickEvent, SeekEvent, ClipUpdateEvent, ProceduralUpdateEvent } from '../../domain/entities/director/directorEvents.types';

export type { TickEvent, SeekEvent, ClipUpdateEvent, ProceduralUpdateEvent };

type EventHandler<T> = (event: T) => void;

class DirectorEventBus {
  private tickHandlers = new Set<EventHandler<TickEvent>>();
  private seekHandlers = new Set<EventHandler<SeekEvent>>();
  private clipUpdateHandlers = new Set<EventHandler<ClipUpdateEvent>>();
  private proceduralUpdateHandlers = new Set<EventHandler<ProceduralUpdateEvent>>();

  // === Tick 事件 ===
  emitTick(event: TickEvent): void {
    this.tickHandlers.forEach(handler => handler(event));
  }

  onTick(handler: EventHandler<TickEvent>): () => void {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  // === Seek 事件 ===
  emitSeek(event: SeekEvent): void {
    this.seekHandlers.forEach(handler => handler(event));
  }

  onSeek(handler: EventHandler<SeekEvent>): () => void {
    this.seekHandlers.add(handler);
    return () => this.seekHandlers.delete(handler);
  }

  // === ClipUpdate 事件 ===
  emitClipUpdate(event: ClipUpdateEvent): void {
    this.clipUpdateHandlers.forEach(handler => handler(event));
  }

  onClipUpdate(handler: EventHandler<ClipUpdateEvent>): () => void {
    this.clipUpdateHandlers.add(handler);
    return () => this.clipUpdateHandlers.delete(handler);
  }

  // === ProceduralUpdate 事件（程式化動畫） ===
  emitProceduralUpdate(event: ProceduralUpdateEvent): void {
    this.proceduralUpdateHandlers.forEach(handler => handler(event));
  }

  onProceduralUpdate(handler: EventHandler<ProceduralUpdateEvent>): () => void {
    this.proceduralUpdateHandlers.add(handler);
    return () => this.proceduralUpdateHandlers.delete(handler);
  }

  // === 清理 ===
  clear(): void {
    this.tickHandlers.clear();
    this.seekHandlers.clear();
    this.clipUpdateHandlers.clear();
    this.proceduralUpdateHandlers.clear();
  }

  // === 用於測試 ===
  get tickHandlerCount(): number {
    return this.tickHandlers.size;
  }

  get seekHandlerCount(): number {
    return this.seekHandlers.size;
  }

  get clipUpdateHandlerCount(): number {
    return this.clipUpdateHandlers.size;
  }

  get proceduralUpdateHandlerCount(): number {
    return this.proceduralUpdateHandlers.size;
  }
}

export const directorEventBus = new DirectorEventBus();

