import type { BaseTrackSet } from '../types/buffer';

/**
 * Safari 26's ManagedMediaSource has a bug where the first MMS instance after
 * browser cold start fails with an internal "ended" state. This function warms
 * up Safari's MMS subsystem by creating a sacrificial MMS, attaching it to the
 * media element, appending a minimal buffer, then cleaning up.
 */
export function warmupManagedMediaSource(
  media: HTMLMediaElement,
): Promise<void> {
  return new Promise((resolve) => {
    const MMS = (self as any).ManagedMediaSource;
    if (!MMS) {
      resolve();
      return;
    }
    const ms = new MMS();
    const url = self.URL.createObjectURL(ms);
    const cleanup = () => {
      media.removeAttribute('src');
      // Remove <source> children
      const sources = media.querySelectorAll('source');
      sources.forEach((s) => s.remove());
      self.URL.revokeObjectURL(url);
      resolve();
    };
    ms.addEventListener(
      'sourceopen',
      () => {
        const sb = ms.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
        sb.addEventListener('updateend', cleanup, { once: true });
        sb.addEventListener('error', cleanup, { once: true });
        // Minimal ftyp box to trigger Safari's codec initialization
        sb.appendBuffer(
          new Uint8Array([
            0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
            0x6d, 0x00, 0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d,
          ]),
        );
      },
      { once: true },
    );
    media.disableRemotePlayback = media.disableRemotePlayback || true;
    // Add <source> element
    const source = self.document.createElement('source');
    source.type = 'video/mp4';
    source.src = url;
    media.appendChild(source);
    media.load();
  });
}

export function getMediaSource(
  preferManagedMediaSource = true,
): typeof MediaSource | undefined {
  if (typeof self === 'undefined') return undefined;
  const mms =
    (preferManagedMediaSource || !self.MediaSource) &&
    ((self as any).ManagedMediaSource as undefined | typeof MediaSource);
  return (
    mms ||
    self.MediaSource ||
    ((self as any).WebKitMediaSource as typeof MediaSource)
  );
}

export function isManagedMediaSource(source: typeof MediaSource | undefined) {
  return (
    typeof self !== 'undefined' && source === (self as any).ManagedMediaSource
  );
}

export function isCompatibleTrackChange(
  currentTracks: BaseTrackSet,
  requiredTracks: BaseTrackSet,
): boolean {
  const trackNames = Object.keys(currentTracks);
  const requiredTrackNames = Object.keys(requiredTracks);
  const trackCount = trackNames.length;
  const requiredTrackCount = requiredTrackNames.length;
  return (
    !trackCount ||
    !requiredTrackCount ||
    (trackCount === requiredTrackCount &&
      !trackNames.some((name) => requiredTrackNames.indexOf(name) === -1))
  );
}
