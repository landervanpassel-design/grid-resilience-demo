import { generateSDEPaths, SimParams } from './engine';

self.onmessage = (e: MessageEvent<{ type: string; params: SimParams }>) => {
  if (e.data.type === 'RUN') {
    const result = generateSDEPaths(e.data.params, (percent) => {
      self.postMessage({ type: 'PROGRESS', percent });
    });
    self.postMessage({ type: 'DONE', result });
  }
};
