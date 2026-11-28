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
import { useI18n, type MessageKey } from '../i18n/core'
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
const NOT_A_BOOK: MessageKey = 'scanner.notBook'

/** Props of {@link BarcodeScanner}. */
export interface BarcodeScannerProps {
  /** Called once with the ISBN-13 that was read. */
  onDetected: (isbn: string) => void
  onClose: () => void
}

/**
 * Turns a camera start failure into the key of a user-facing message.
 *
 * @param error - Error thrown by `getUserMedia` / the scanner.
 */
function cameraErrorMessage(error: unknown): MessageKey {
  const text = String(error instanceof Error ? error.name + error.message : error)
  if (/NotAllowed|Permission/i.test(text)) return 'scanner.denied'
  if (/NotFound|no camera|Requested device not found/i.test(text)) return 'scanner.noCamera'
  if (!window.isSecureContext) return 'scanner.insecure'
  return 'scanner.failed'
}

/**
 * Renders the scanner dialog. The camera starts when the dialog opens and is
 * released when it closes.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const detectedRef = useRef(false)
  const { t } = useI18n()
  const [cameraError, setCameraError] = useState<MessageKey | null>(null)
  const [hint, setHint] = useState<MessageKey | null>(null)
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
      setHint('scanner.noBarcode')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t('scanner.dialog')}>
      <div className="w-full max-w-md space-y-4 rounded-[var(--radius-ui)] bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 em text-lg">
            <Camera className="h-5 w-5" aria-hidden="true" />
            {t('scanner.title')}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-raised" aria-label={t('scanner.close')}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div id={SCANNER_ELEMENT_ID} className="min-h-12 overflow-hidden rounded-[var(--radius-ui)] bg-black" />

        {cameraActive && !cameraError && (
          <p className="text-[15px] text-muted">{t('scanner.point')}</p>
        )}
        {cameraError && <p className="text-[15px] text-warn">{t(cameraError)}</p>}
        {hint && (
          <p className="text-[15px] text-danger" role="alert">
            {t(hint)}
          </p>
        )}

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-ui)] border border-line px-4 py-2 text-[15px] hover:bg-raised">
          <ImageUp className="h-4 w-4" aria-hidden="true" />
          {t('scanner.photo')}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void handleFile(event)} />
        </label>
      </div>
    </div>
  )
}
