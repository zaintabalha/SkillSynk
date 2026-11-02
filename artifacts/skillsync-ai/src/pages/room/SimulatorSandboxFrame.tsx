import { useLayoutEffect, useRef } from 'react';
import {
  createSimulatorSandboxDocument,
  isSimulatorSandboxEvent,
  SIMULATOR_SANDBOX_CHANNEL,
  type SimulatorSandboxEvent,
} from '@/lib/simulator-sandbox';

type Props = {
  code: string;
  runId: number;
  onMessage: (event: SimulatorSandboxEvent) => void;
};

const sandboxDocument = createSimulatorSandboxDocument();

export function SimulatorSandboxFrame({ code, runId, onMessage }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onMessageRef = useRef(onMessage);
  const startedRef = useRef(false);

  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useLayoutEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== 'null' || event.source !== frameRef.current?.contentWindow || !isSimulatorSandboxEvent(event.data)) return;
      if (event.data.channel !== SIMULATOR_SANDBOX_CHANNEL || event.data.runId !== runId) return;
      onMessageRef.current(event.data);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runId]);

  const start = () => {
    if (startedRef.current) {
      onMessageRef.current({
        channel: SIMULATOR_SANDBOX_CHANNEL,
        runId,
        type: 'navigation',
        text: 'Sandbox navigation was blocked.',
      });
      return;
    }
    startedRef.current = true;
    frameRef.current?.contentWindow?.postMessage({
      channel: SIMULATOR_SANDBOX_CHANNEL,
      type: 'run',
      runId,
      code,
    }, '*');
  };

  return (
    <iframe
      ref={frameRef}
      className="sim-live-frame"
      title="Isolated interactive simulator preview"
      sandbox="allow-scripts"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
      referrerPolicy="no-referrer"
      srcDoc={sandboxDocument}
      onLoad={start}
    />
  );
}
