import { SetSfx } from "@port-of-mars/shared/game/responses";
import { Sfx } from "@port-of-mars/shared/game/responses";
import { Howl } from "howler";

export function url(path: string) {
  // workaround to connect to localhost:2567 server endpoints
  return `${process.env.SERVER_URL_HTTP}${path}`;
}

export class SfxCache {
  cache: Record<string, Howl>;

  constructor() {
    this.cache = {};
    for (const [_name, relpath] of Object.entries(Sfx)) {
      this.cache[relpath] = new Howl({
        src: require(`@port-of-mars/client/assets/sfx/${relpath}`),
      });
    }
  }

  public getSoundPath(sound: Sfx): string {
    return `${sound}`;
  }

  public getSound(sfx: Sfx): Howl {
    const sound = this.cache[sfx];
    if (!sound) {
      throw new Error(`sound ${sound} does not exist`);
    }
    return sound;
  }
}

export class SfxManager {
  activeSfx: Howl | null;
  activeSoundId: number | null;
  private cache: SfxCache;

  constructor() {
    this.activeSfx = null;
    this.cache = new SfxCache();
    this.activeSoundId = null;
  }

  public play(sound: SetSfx, volume: number = 1.0) {
    if (this.activeSfx?.playing()) {
      this.activeSfx.stop();
    }
    this.activeSfx = this.cache.getSound(sound.sfx as Sfx);
    this.activeSfx.on("end", () => {
      this.activeSfx = null;
    });
    this.activeSfx.volume(volume);
    this.activeSoundId = this.activeSfx.play();
  }
}
