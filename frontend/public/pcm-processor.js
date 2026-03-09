class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inputSampleRate = sampleRate;
    this._targetSampleRate = 16000;
    this._ratio = this._inputSampleRate / this._targetSampleRate;
    this._remainder = 0;
  }

  process(inputs) {
    const input = inputs[0][0];
    if (!input) return true;

    // ダウンサンプリング（線形補間）
    const samples = [];
    let i = this._remainder;
    while (i < input.length) {
      samples.push(input[Math.floor(i)]);
      i += this._ratio;
    }
    this._remainder = i - input.length;

    // Float32 → Int16
    const int16 = new Int16Array(samples.length);
    for (let j = 0; j < samples.length; j++) {
      int16[j] = Math.max(-32768, Math.min(32767, samples[j] * 32768));
    }

    if (int16.length > 0) {
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-processor", PcmProcessor);
