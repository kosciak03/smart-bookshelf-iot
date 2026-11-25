/**
 * @packageDocumentation
 * Dialog that reads a book's ISBN barcode (EAN-13) with the device camera, or
 * from a photo when no camera is available.
 *
 * Browsers only allow camera access in a secure context: `localhost` works,
 * but a phone opening the app over plain `http://<LAN IP>` gets no camera, so
 * the photo fallback is always offered.
 */
import { Html5Qrcode, Html5QrcodeSupportedFormats, type Html5QrcodeFullConfig } from 'html5-qrcode'
import { Camera, ImageUp, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { isbnFromBarcode } from '../lib/isbn'

/** DOM id of the element the scanner renders the camera preview into. */
const SCANNER_ELEMENT_ID = 'isbn-barcode-scanner'

/** Scanner configuration: book barcodes only, native detector when available. */
const SCANNER_CONFIG: Html5QrcodeFullConfig = {
  verbose: false,
  formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
  useBarCodeDetectorIfSupported: true,
}

/** Message shown when a barcode was read but is not an ISBN. */
const NOT_A_BOOK = 'This barcode is not an ISBN (book barcodes start with 978 or 979).'

/** Props of {@link BarcodeScanner}. */
export interface BarcodeScannerProps {
  /** Called once with the ISBN-13 that was read. */
  onDetected: (isbn: string) => void
  onClose: () => void
}

/**
 * Turns a camera start failure into a user-facing message.
 *
 * @param error - Error thrown by `getUserMedia` / the scanner.
 */
function cameraErrorMessage(error: unknown): string {
  const text = String(error instanceof Error ? error.name + error.message : error)
  if (/NotAllowed|Permission/i.test(text)) return 'Camera access was denied. Allow it in the browser or use a photo.'
  if (/NotFound|no camera|Requested device not found/i.test(text)) return 'No camera found. Use a photo of the barcode instead.'
  if (!window.isSecureContext) return 'The camera needs a secure connection (https or localhost). Use a photo instead.'
  return 'The camera could not be started. Use a photo of the barcode instead.'
}

/**
 * Renders the scanner dialog. The camera starts when the dialog opens and is
 * released when it closes.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const detectedRef = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, SCANNER_CONFIG)
    scannerRef.current = scanner
    let cancelled = false

    const handleCode = (code: string) => {
      if (detectedRef.current) return
      const isbn = isbnFromBarcode(code)
      if (isbn === null) {
        setHint(NOT_A_BOOK)
        return
      }
      detectedRef.current = true
      onDetected(isbn)
    }

    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 140 } }, handleCode, undefined)
      .then(() => {
        if (cancelled) void scanner.stop().catch(() => undefined)
        else setCameraActive(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) setCameraError(cameraErrorMessage(error))
      })

    return () => {
      cancelled = true
      if (scanner.isScanning) {
        void scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined)
      }
    }
  }, [onDetected])

  // Close on Escape.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const scanner = scannerRef.current
    if (!file || !scanner) return
    setHint(null)
    try {
      if (scanner.isScanning) await scanner.stop()
      setCameraActive(false)
      const isbn = isbnFromBarcode(await scanner.scanFile(file, false))
      if (isbn === null) setHint(NOT_A_BOOK)
      else onDetected(isbn)
    } catch {
      setHint('No barcode found in the photo. Take it closer, sharp and well lit.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Scan ISBN barcode">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <Camera className="h-5 w-5" aria-hidden="true" />
            Scan the barcode
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Close scanner">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div id={SCANNER_ELEMENT_ID} className="min-h-12 overflow-hidden rounded-lg bg-stone-900" />

        {cameraActive && !cameraError && (
          <p className="text-sm text-stone-600">Point the camera at the barcode on the back cover.</p>
        )}
        {cameraError && <p className="text-sm text-amber-800">{cameraError}</p>}
        {hint && (
          <p className="text-sm text-red-700" role="alert">
            {hint}
          </p>
        )}

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
          <ImageUp className="h-4 w-4" aria-hidden="true" />
          Use a photo of the barcode
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void handleFile(event)} />
        </label>
      </div>
    </div>
  )
}
