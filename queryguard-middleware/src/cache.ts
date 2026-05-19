interface LRUNode<V> {
  key: string;
  value: V;
  expiresAt: number;
  prev: LRUNode<V> | null;
  next: LRUNode<V> | null;
}

export class LRUCache<V> {
  private capacity: number;
  private ttlMs: number;
  private map: Map<string, LRUNode<V>>;
  private head: LRUNode<V>;
  private tail: LRUNode<V>;

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.map = new Map();

    this.head = { key: '', value: null as unknown as V, expiresAt: Infinity, prev: null, next: null };
    this.tail = { key: '', value: null as unknown as V, expiresAt: Infinity, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    if (Date.now() > node.expiresAt) {
      this.remove(node);
      this.map.delete(key);
      return undefined;
    }
    this.moveToFront(node);
    return node.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      node.value = value;
      node.expiresAt = Date.now() + this.ttlMs;
      this.moveToFront(node);
      return;
    }

    const node: LRUNode<V> = {
      key,
      value,
      expiresAt: Date.now() + this.ttlMs,
      prev: null,
      next: null,
    };

    this.map.set(key, node);
    this.addToFront(node);

    if (this.map.size > this.capacity) {
      const evicted = this.tail.prev!;
      if (evicted !== this.head) {
        this.remove(evicted);
        this.map.delete(evicted.key);
      }
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.map.size;
  }

  private addToFront(node: LRUNode<V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private remove(node: LRUNode<V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToFront(node: LRUNode<V>): void {
    this.remove(node);
    this.addToFront(node);
  }
}
