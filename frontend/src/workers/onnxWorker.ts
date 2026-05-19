import * as ort from 'onnxruntime-web';

const PAD = 0;
const UNK = 1;
const BOS = 2;
const EOS = 3;
const MAX_LEN = 256;

let session: ort.InferenceSession | null = null;
let charToIdx: Record<string, number> = {};

function softmax(logits: Float32Array): [number, number] {
  const maxVal = Math.max(logits[0], logits[1]);
  const e0 = Math.exp(logits[0] - maxVal);
  const e1 = Math.exp(logits[1] - maxVal);
  const sum = e0 + e1;
  return [e0 / sum, e1 / sum];
}

function encode(query: string): Int32Array {
  const tokens = new Int32Array(MAX_LEN).fill(PAD);
  tokens[0] = BOS;
  const chars = query.slice(0, MAX_LEN - 2);
  for (let i = 0; i < chars.length; i++) {
    tokens[i + 1] = charToIdx[chars[i]] ?? UNK;
  }
  const eosIdx = Math.min(chars.length + 1, MAX_LEN - 1);
  tokens[eosIdx] = EOS;
  return tokens;
}

async function loadModel() {
  if (session) return;

  const vocabRes = await fetch('/api/onnx/vocab');
  const vocabData = await vocabRes.json() as { char_to_idx: Record<string, number> };
  charToIdx = vocabData.char_to_idx;

  session = await ort.InferenceSession.create('/api/onnx/download', {
    executionProviders: ['wasm'],
  });
}

self.onmessage = async (e: MessageEvent<{ query: string }>) => {
  const { query } = e.data;
  const t0 = performance.now();

  try {
    await loadModel();

    const tokens = encode(query);
    const tensor = new ort.Tensor('int32', tokens, [1, MAX_LEN]);
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = session!.inputNames[0];
    feeds[inputName] = tensor;

    const results = await session!.run(feeds);
    const logits = results[session!.outputNames[0]].data as Float32Array;
    const [safe_prob, malicious_prob] = softmax(logits);
    const latency_ms = Math.round(performance.now() - t0);

    self.postMessage({
      result: {
        label: malicious_prob > 0.5 ? 'MALICIOUS' : 'SAFE',
        safe_prob,
        malicious_prob,
        latency_ms,
      },
    });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : 'ONNX inference failed' });
  }
};
