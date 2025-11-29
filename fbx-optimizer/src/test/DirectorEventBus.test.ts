import { describe, it, expect, vi, beforeEach } from 'vitest';
import { directorEventBus } from '../infrastructure/events';

describe('DirectorEventBus', () => {
  beforeEach(() => {
    directorEventBus.clear();
  });

  describe('Tick Event', () => {
    it('should emit and receive tick events', () => {
      const handler = vi.fn();
      directorEventBus.onTick(handler);
      
      directorEventBus.emitTick({ delta: 0.016 });
      
      expect(handler).toHaveBeenCalledWith({ delta: 0.016 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const handler = vi.fn();
      const unsubscribe = directorEventBus.onTick(handler);
      
      unsubscribe();
      directorEventBus.emitTick({ delta: 0.016 });
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      directorEventBus.onTick(handler1);
      directorEventBus.onTick(handler2);
      directorEventBus.emitTick({ delta: 0.016 });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Seek Event', () => {
    it('should emit and receive seek events', () => {
      const handler = vi.fn();
      directorEventBus.onSeek(handler);
      
      directorEventBus.emitSeek({ frame: 100 });
      
      expect(handler).toHaveBeenCalledWith({ frame: 100 });
    });

    it('should unsubscribe correctly', () => {
      const handler = vi.fn();
      const unsubscribe = directorEventBus.onSeek(handler);
      
      unsubscribe();
      directorEventBus.emitSeek({ frame: 100 });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('ClipUpdate Event', () => {
    it('should emit and receive clipUpdate events', () => {
      const handler = vi.fn();
      directorEventBus.onClipUpdate(handler);
      
      const event = {
        modelId: 'model-1',
        animationId: 'anim-1',
        localTime: 1.5,
        localFrame: 45,
      };
      directorEventBus.emitClipUpdate(event);
      
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should unsubscribe correctly', () => {
      const handler = vi.fn();
      const unsubscribe = directorEventBus.onClipUpdate(handler);
      
      unsubscribe();
      directorEventBus.emitClipUpdate({
        modelId: 'model-1',
        animationId: 'anim-1',
        localTime: 1.5,
        localFrame: 45,
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Clear', () => {
    it('should clear all handlers', () => {
      const tickHandler = vi.fn();
      const seekHandler = vi.fn();
      const clipHandler = vi.fn();
      
      directorEventBus.onTick(tickHandler);
      directorEventBus.onSeek(seekHandler);
      directorEventBus.onClipUpdate(clipHandler);
      
      directorEventBus.clear();
      
      directorEventBus.emitTick({ delta: 0.016 });
      directorEventBus.emitSeek({ frame: 100 });
      directorEventBus.emitClipUpdate({
        modelId: 'model-1',
        animationId: 'anim-1',
        localTime: 1.5,
        localFrame: 45,
      });
      
      expect(tickHandler).not.toHaveBeenCalled();
      expect(seekHandler).not.toHaveBeenCalled();
      expect(clipHandler).not.toHaveBeenCalled();
    });
  });

  describe('Handler Count', () => {
    it('should track handler counts', () => {
      expect(directorEventBus.tickHandlerCount).toBe(0);
      
      const unsubscribe = directorEventBus.onTick(() => {});
      expect(directorEventBus.tickHandlerCount).toBe(1);
      
      unsubscribe();
      expect(directorEventBus.tickHandlerCount).toBe(0);
    });
  });
});

