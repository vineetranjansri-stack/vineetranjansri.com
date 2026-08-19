import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

const SCANNER_ELEMENT_ID = 'camera-scanner-viewport';

interface ScannerProps {
  onDecode: (value: string) => void;
  disabled?: boolean;
}

export default function Scanner({ onDecode, disabled }: ScannerProps) {
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => undefined);
      }
    };
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODABAR,
      ];
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: formats,
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          onDecode(decodedText.trim());
        },
        () => {
          // ignore per-frame decode misses
        },
      );
      setCameraOn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access camera.');
      setCameraOn(false);
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // already stopped
      }
    }
    scannerRef.current = null;
    setCameraOn(false);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    onDecode(value);
    setManualValue('');
    manualInputRef.current?.focus();
  }

  return (
    <div className="scanner">
      <div className="scanner-camera-block">
        <div id={SCANNER_ELEMENT_ID} className={cameraOn ? 'scanner-viewport active' : 'scanner-viewport'} />
        {!cameraOn ? (
          <button type="button" className="btn btn-primary" onClick={startCamera} disabled={disabled}>
            Start Camera Scan
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={stopCamera}>
            Stop Camera
          </button>
        )}
        {error && <p className="scanner-error">{error}</p>}
      </div>

      <form className="scanner-manual" onSubmit={submitManual}>
        <label htmlFor="manual-serial">Manual entry / hardware scanner input</label>
        <div className="scanner-manual-row">
          <input
            id="manual-serial"
            ref={manualInputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="Scan with USB/Bluetooth scanner or type serial number"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            disabled={disabled}
          />
          <button type="submit" className="btn btn-outline" disabled={disabled}>
            Add
          </button>
        </div>
        <p className="hint">
          A USB or Bluetooth barcode scanner types into this field automatically (it behaves like a
          keyboard) — just click into it and start scanning, no camera needed.
        </p>
      </form>
    </div>
  );
}
