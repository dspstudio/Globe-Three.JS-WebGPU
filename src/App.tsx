/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { EarthCanvas } from './components/EarthCanvas';
import { Loader } from './components/Loader';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Initializing WebGPU');

  const handleLoad = useCallback(() => {
    setLoadingMsg('Loading Complete');
    setTimeout(() => {
      setLoading(false);
    }, 200);
  }, []);

  return (
    <div className="relative w-screen h-screen">
      <EarthCanvas onLoad={handleLoad} onProgress={setLoadingMsg} />
      <Loader visible={loading} message={loadingMsg} />
    </div>
  );
}
