import monthlyExpected from '../../samples/receipts/lalitamba-fd-01FD40599.expected.json'
import monthlyGemini from '../../samples/receipts/lalitamba-fd-01FD40599.gemini.json'
import maturityExpected from '../../samples/receipts/lalitamba-fd-01FD32450.expected.json'
import maturityGemini from '../../samples/receipts/lalitamba-fd-01FD32450.gemini.json'

import { mapLalitambaExtraction, type MappedExtraction } from '@/lib/lalitamba-map'

const fixtures = {
  '01FD40599': {
    expected: monthlyExpected,
    gemini: monthlyGemini,
    rawText: null as string | null,
  },
  '01FD32450': {
    expected: maturityExpected,
    gemini: maturityGemini,
    rawText: String(
      (maturityGemini as { raw_text?: string }).raw_text ?? '',
    ),
  },
} as const

export type FixtureId = keyof typeof fixtures

export function fixtureIdFromName(name: string): FixtureId | null {
  if (/01FD40599/i.test(name)) return '01FD40599'
  if (/01FD32450/i.test(name)) return '01FD32450'
  return null
}

export function extractionFromFixture(id: FixtureId): MappedExtraction {
  const fixture = fixtures[id]
  return mapLalitambaExtraction(fixture.gemini, fixture.rawText)
}
