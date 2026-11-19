/**
 * Casual walking for the people and the agents. Each walker has a home (a
 * desk, or its place in an agent bay) and every so often heads out to do
 * something elsewhere on its floor, then comes back.
 *
 * Routes are laid by hand to stay clear of the furniture. Every spot lists
 * the points that lead to it from its floor's corridor (`via`, corridor
 * first), so a walk is: back out along the old spot's route to the corridor,
 * along the corridor, then in along the new spot's route.
 */
import type { TransformNode } from "@babylonjs/core";
import type { Bubble } from "./kit";

export type Pt = readonly [number, number];

export interface Spot {
  at: Pt;
  /** Facing while there, as rotation.y for a body that looks along +z. */
  face: number;
  /** Points from the corridor to the spot; the first is on the corridor. */
  via: Pt[];
  /** Shared spots are booked so two walkers never stand in the same place. */
  key?: string;
}

/** Somewhere to go, what to do there and for how long. */
export interface Outing {
  spot: Spot;
  /** Shown in the bubble, and in the inspector while there. */
  task: string;
  /** Shown in the inspector on the way: "Heading to {where}". */
  where: string;
  dwell: number;
}

export interface WalkerBody {
  root: TransformNode;
  walk(on: boolean): void;
}

/** Bookings for the shared spots on one floor. */
export class SpotBook {
  private readonly taken = new Set<string>();

  free(key?: string): boolean {
    return !key || !this.taken.has(key);
  }

  take(key?: string): void {
    if (key) this.taken.add(key);
  }

  release(key?: string): void {
    if (key) this.taken.delete(key);
  }
}

export interface WandererOptions {
  body: WalkerBody;
  home: Spot;
  /** "the desk" or "the bay", for "Heading back to …". */
  homeName: string;
  /** Picks the next outing, or null to stay home a while longer. */
  plan(): Outing | null;
  /** Something to be doing at home. */
  homeTask(): string | null;
  homeDwell: [number, number];
  speed: number;
  book: SpotBook;
  rand: () => number;
  bubble?: Bubble;
  /** Added to every facing, for bodies that look along -z. */
  yaw?: number;
  /** Gentle look-around while standing still, in radians. */
  sway?: number;
}

const TWO_PI = Math.PI * 2;
/** Shortest signed angle, in (-π, π]. */
const wrap = (a: number): number => ((((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
const between = ([a, b]: [number, number], r: number): number => a + (b - a) * r;

export class Wanderer {
  /** What the walker is doing right now, for the inspector. */
  task: string | null;
  private spot: Spot;
  private dest: Spot | null = null;
  private job: Outing | null = null;
  private route: Pt[] = [];
  /** Index in `route` where the destination's own `via` begins. */
  private split = 0;
  /** Index of the point being walked to. */
  private next = 0;
  private wait: number;
  private held = false;
  private pinned = false;
  private bubbleLeft = 0;
  private facing: number;
  private clock: number;

  constructor(private readonly o: WandererOptions) {
    this.spot = o.home;
    o.book.take(o.home.key);
    const root = o.body.root;
    root.position.x = o.home.at[0];
    root.position.z = o.home.at[1];
    this.facing = o.home.face + (o.yaw ?? 0);
    root.rotation.y = this.facing;
    // Stagger the first outings so the floor doesn't all move at once.
    this.wait = between(o.homeDwell, o.rand());
    this.clock = o.rand() * 10;
    this.task = o.homeTask();
  }

  get walking(): boolean {
    return this.dest !== null;
  }

  /** At home and standing still. */
  get isHome(): boolean {
    return this.dest === null && this.spot === this.o.home;
  }

  /** Where the walker is standing, or null while it is walking. */
  get here(): Spot | null {
    return this.dest ? null : this.spot;
  }

  /** Keep the walker at home; it walks back first if it is out. */
  hold(on: boolean): void {
    if (this.held === on) return;
    this.held = on;
    if (!on || this.pinned) return;
    const heading = this.dest ?? this.spot;
    if (heading !== this.o.home) this.goTo(this.o.home, null);
  }

  /** Send the walker somewhere and keep it there until `release()`. */
  pin(outing: Outing): void {
    this.pinned = true;
    this.goTo(outing.spot, { ...outing, dwell: Infinity });
  }

  release(): void {
    if (!this.pinned) return;
    this.pinned = false;
    this.goTo(this.o.home, null);
  }

  /** Jump straight home, for when its floor is moved out of the way mid-walk. */
  snapHome(): void {
    this.o.book.release((this.dest ?? this.spot).key);
    this.o.book.take(this.o.home.key);
    this.pinned = false;
    this.dest = null;
    this.job = null;
    this.spot = this.o.home;
    const root = this.o.body.root;
    root.position.x = this.o.home.at[0];
    root.position.z = this.o.home.at[1];
    this.facing = this.o.home.face + (this.o.yaw ?? 0);
    root.rotation.y = this.facing;
    this.o.body.walk(false);
    this.o.bubble?.hide();
    this.bubbleLeft = 0;
    this.task = this.o.homeTask() ?? this.task;
    this.wait = between(this.o.homeDwell, this.o.rand());
  }

  update(dt: number): void {
    const root = this.o.body.root;
    this.clock += dt;
    if (this.bubbleLeft > 0) {
      this.bubbleLeft -= dt;
      if (this.bubbleLeft <= 0) this.o.bubble?.hide();
    }
    if (this.dest) {
      this.walk(dt);
      return;
    }
    // Standing still: turn to face the task, with a gentle look-around.
    const sway = (this.o.sway ?? 0) * Math.sin(this.clock * 0.6);
    root.rotation.y += wrap(this.facing + sway - root.rotation.y) * Math.min(1, dt * 6);
    if (this.pinned) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    if (this.spot !== this.o.home) {
      this.goTo(this.o.home, null);
      return;
    }
    const outing = this.held ? null : this.o.plan();
    if (outing && outing.spot !== this.o.home && this.o.book.free(outing.spot.key)) {
      this.goTo(outing.spot, outing);
      return;
    }
    this.wait = between(this.o.homeDwell, this.o.rand());
    this.task = this.o.homeTask() ?? this.task;
    if (this.task && this.o.rand() < 0.4) this.say(this.task);
  }

  private walk(dt: number): void {
    const root = this.o.body.root;
    let step = this.o.speed * dt;
    while (step > 0 && this.dest) {
      const [tx, tz] = this.route[this.next];
      const dx = tx - root.position.x;
      const dz = tz - root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
        root.position.x = tx;
        root.position.z = tz;
        step -= dist;
        this.next++;
        if (this.next >= this.route.length) this.arrive();
      } else {
        root.position.x += (dx / dist) * step;
        root.position.z += (dz / dist) * step;
        const heading = Math.atan2(dx, dz) + (this.o.yaw ?? 0);
        root.rotation.y += wrap(heading - root.rotation.y) * Math.min(1, dt * 12);
        step = 0;
      }
    }
  }

  private goTo(spot: Spot, job: Outing | null): void {
    this.o.book.release((this.dest ?? this.spot).key);
    this.o.book.take(spot.key);
    const tail = [...spot.via, spot.at];
    if (!this.dest) {
      const out = [...this.spot.via].reverse();
      this.route = [...out, ...tail];
      this.split = out.length;
    } else if (this.next < this.split) {
      // Still heading out to the corridor: get there first.
      const out = this.route.slice(this.next, this.split);
      this.route = [...out, ...tail];
      this.split = out.length;
    } else if (this.next === this.split) {
      // On the corridor: turn along it towards the new spot.
      this.route = tail;
      this.split = 0;
    } else {
      // Already on the way in to the old spot: back out the way it came.
      const back = this.route.slice(this.split, this.next).reverse();
      this.route = [...back, ...tail];
      this.split = back.length;
    }
    this.next = 0;
    this.dest = spot;
    this.job = job;
    this.task = job ? `Heading to ${job.where}` : `Heading back to ${this.o.homeName}`;
    this.o.bubble?.hide();
    this.bubbleLeft = 0;
    this.o.body.walk(true);
  }

  private arrive(): void {
    const spot = this.dest!;
    this.dest = null;
    this.spot = spot;
    this.o.body.walk(false);
    this.facing = spot.face + (this.o.yaw ?? 0);
    if (this.job) {
      this.task = this.job.task;
      this.wait = this.job.dwell;
      this.say(this.job.task);
    } else {
      this.task = this.o.homeTask() ?? this.task;
      this.wait = between(this.o.homeDwell, this.o.rand());
      if (this.task && this.o.rand() < 0.35) this.say(this.task);
    }
    this.job = null;
  }

  /** Show a speech bubble for a few seconds. */
  say(text: string, seconds = 3.6): void {
    if (!this.o.bubble) return;
    this.o.bubble.say(text);
    this.bubbleLeft = seconds;
  }
}
