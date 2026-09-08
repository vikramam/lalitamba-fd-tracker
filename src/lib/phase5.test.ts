import { afterEach, describe, expect, it } from 'vitest'

import { replaceDemoReceipt, resetDemoStore } from '@/lib/demo-store'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'
import { assertReceiptFile, isHeifFile, isPdfFile, prepareReceiptFile } from '@/lib/receipt-file'
import { currentReceipt } from '@/lib/receipt-map'
import {
  publicReceiptUrl,
  receiptStoragePath,
  sanitizeReceiptFileName,
} from '@/lib/receipt-path'
import { downloadFdReceipt, receiptViewUrl, shareFdReceipt } from '@/lib/receipts'

const memory = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
})

afterEach(() => {
  resetDemoStore()
  memory.clear()
})

describe('receipt files', () => {
  it('rejects an empty file', () => {
    expect(() =>
      assertReceiptFile(new File([], 'empty.jpg', { type: 'image/jpeg' })),
    ).toThrow('Choose a receipt photo.')
  })

  it('detects HEIF and PDF', () => {
    expect(isHeifFile(new File([new Uint8Array([1])], 'slip.HEIC'))).toBe(true)
    expect(isPdfFile(new File([new Uint8Array([1])], 'scan.pdf', { type: 'application/pdf' }))).toBe(
      true,
    )
  })

  it('passes a PDF through without converting', async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'scan.pdf', {
      type: 'application/pdf',
    })
    const prepared = await prepareReceiptFile(pdf)
    expect(prepared.file.type).toBe('application/pdf')
    expect(prepared.previewUrl).toBeNull()
    expect(prepared.originalName).toBe('scan.pdf')
    expect(prepared.originalSize).toBe(pdf.size)
  })
})

describe('receipt paths', () => {
  it('builds a family-scoped storage path', () => {
    const path = receiptStoragePath({
      familyId: DEMO_IDS.mulgundFamily,
      userId: DEMO_IDS.vikram,
      fdId: DEMO_IDS.fd40599,
      fileName: sanitizeReceiptFileName('Slip.HEIC', 'image/jpeg'),
      at: 1700000000000,
    })
    expect(path).toBe(
      `${DEMO_IDS.mulgundFamily}/${DEMO_IDS.vikram}/${DEMO_IDS.fd40599}/1700000000000-slip.jpg`,
    )
  })

  it('points public URLs at the public object endpoint', () => {
    expect(
      publicReceiptUrl('https://example.supabase.co', 'fam/user/fd/receipt.jpg'),
    ).toBe('https://example.supabase.co/storage/v1/object/public/fd-receipts/fam/user/fd/receipt.jpg')
  })
})

describe('receipt replacement and isolation', () => {
  it('keeps only one current receipt after a replace', () => {
    replaceDemoReceipt({
      family_id: DEMO_IDS.mulgundFamily,
      fd_id: DEMO_IDS.fd40599,
      storage_path: 'a/b/c/1-receipt.jpg',
      file_name: 'one.jpg',
      mime_type: 'image/jpeg',
      file_size: 12,
      uploaded_by: DEMO_IDS.vikram,
    })
    replaceDemoReceipt({
      family_id: DEMO_IDS.mulgundFamily,
      fd_id: DEMO_IDS.fd40599,
      storage_path: 'a/b/c/2-receipt.jpg',
      file_name: 'two.jpg',
      mime_type: 'image/jpeg',
      file_size: 14,
      uploaded_by: DEMO_IDS.vikram,
    })

    const vikram = demoHousehold('vikram@family.test')
    const current = currentReceipt(vikram.receipts, DEMO_IDS.fd40599)
    expect(current?.file_name).toBe('two.jpg')
    expect(current?.is_current).toBe(true)
    expect(vikram.receipts.filter((row) => row.fd_id === DEMO_IDS.fd40599)).toHaveLength(2)
    expect(
      vikram.receipts.filter((row) => row.fd_id === DEMO_IDS.fd40599 && row.is_current),
    ).toHaveLength(1)
  })

  it('hides Mulgund receipts from the other family', async () => {
    replaceDemoReceipt({
      family_id: DEMO_IDS.mulgundFamily,
      fd_id: DEMO_IDS.fd40599,
      storage_path: `${DEMO_IDS.mulgundFamily}/${DEMO_IDS.vikram}/${DEMO_IDS.fd40599}/x-receipt.jpg`,
      file_name: 'secret.jpg',
      mime_type: 'image/jpeg',
      file_size: 20,
      uploaded_by: DEMO_IDS.vikram,
      preview_url: 'data:image/jpeg;base64,xx',
    })

    const vikram = demoHousehold('vikram@family.test')
    const other = demoHousehold('other@family.test')
    const receipt = currentReceipt(vikram.receipts, DEMO_IDS.fd40599)
    expect(receipt?.file_name).toBe('secret.jpg')
    expect(other.receipts.map((row) => row.file_name)).not.toContain('secret.jpg')
    await expect(receiptViewUrl(receipt!, other)).rejects.toThrow("You don't have access")
    await expect(downloadFdReceipt(receipt!, other)).rejects.toThrow("You don't have access")
    await expect(shareFdReceipt(receipt!, other)).rejects.toThrow("You don't have access")
  })
})
