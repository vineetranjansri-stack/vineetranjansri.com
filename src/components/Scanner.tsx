import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

const SCANNER_ELEMENT_ID = 'camera-scanner-viewport';
const FILE_SCANNER_ELEMENT_ID = 'photo-scanner-viewport';

async function loadFormats() {
  const { Html5QrcodeSupportedFormats } = await import('html5-qrcode');
  return [
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
}

interface ScannerProps {
  onDecode: (value: string) => void;
  onBatchDecoded: (serials: string[], failedFileNames: string[]) => void;
  disabled?: boolean;
}

export default function Scanner({ onDecode, onBatchDecoded, disabled }: ScannerProps) {
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [decodingFiles, setDecodingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => undefined);
      }
    };
  }, []);

  // Keep the scanner-gun input focused and ready whenever it's usable — a Bluetooth/USB
  // scanner gun pairs as a keyboard, so it can only "type" a scan into whichever element
  // currently has focus. Retries for ~300ms because tapping the Intact/Damaged button that
  // triggers this can itself grab focus a beat later on some mobile browsers, silently
  // swallowing the next trigger pull if we only tried once.
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    let attempts = 0;
    const tryFocus = () => {
      if (cancelled) return;
      const el = manualInputRef.current;
      if (!el) return;
      if (document.activeElement !== el) el.focus();
      attempts += 1;
      if (attempts < 6 && document.activeElement !== el) {
        setTimeout(tryFocus, 60);
      }
    };
    tryFocus();
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  async function startCamera() {
    setError(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const formats = await loadFormats();
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

  async function handlePhotoFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    setFileError(null);
    setDecodingFiles(true);
    const decoded: string[] = [];
    const failed: string[] = [];
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const formats = await loadFormats();
      for (const file of files) {
        try {
          const scanner = new Html5Qrcode(FILE_SCANNER_ELEMENT_ID, { formatsToSupport: formats, verbose: false });
          const result = await scanner.scanFile(file, false);
          decoded.push(result.trim());
          scanner.clear();
        } catch {
          failed.push(file.name);
        }
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read those photos.');
    } finally {
      setDecodingFiles(false);
      onBatchDecoded(decoded, failed);
    }
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
      <form className="scanner-manual scanner-gun" onSubmit={submitManual}>
        <h3>Bluetooth / USB Scanner Gun</h3>
        <ol className="scanner-gun-steps">
          <li>Pair the scanner in your device's Bluetooth settings first (it connects as a wireless keyboard, not through this app).</li>
          <li>Tap the box below once so it's focused, then start scanning — each trigger pull types the code and submits it automatically.</li>
        </ol>
        <label htmlFor="manual-serial">Scan gun input</label>
        <div className="scanner-manual-row">
          <input
            id="manual-serial"
            ref={manualInputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoFocus
            placeholder="Tap here, then pull the trigger — or type a serial number"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            disabled={disabled}
          />
          <button type="submit" className="btn btn-outline" disabled={disabled}>
            Add
          </button>
        </div>
        <p className="hint">
          Browsers can't detect Bluetooth pairing status directly, so there's no "connected" indicator here —
          if scans aren't appearing, re-tap the box above to make sure it still has focus.
        </p>
      </form>

      <div className="scanner-camera-block">
        <h3>Camera Scan</h3>
        <p className="hint">No scanner gun handy? Use your phone or tablet's camera instead.</p>
        <div id={SCANNER_ELEMENT_ID} className={cameraOn ? 'scanner-viewport active' : 'scanner-viewport'} />
        {!cameraOn ? (
          <button type="button" className="btn btn-secondary" onClick={startCamera} disabled={disabled}>
            Start Camera Scan
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={stopCamera}>
            Stop Camera
          </button>
        )}
        {error && <p className="scanner-error">{error}</p>}
      </div>

      <div className="scanner-upload-block">
        <h3>Upload Photo(s) of Barcode</h3>
        <p className="hint">
          Already have photos with the panel's barcode/QR label visible? Upload one or several — each is
          decoded and queued for you to classify Intact/Damaged one at a time, same as a live scan.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoFilesSelected}
          disabled={decodingFiles}
        />
        {decodingFiles && <p className="hint">Reading barcodes from photo(s)…</p>}
        {fileError && <p className="scanner-error">{fileError}</p>}
        <div id={FILE_SCANNER_ELEMENT_ID} className="file-scanner-hidden" />
      </div>
    </div>
  );
}
