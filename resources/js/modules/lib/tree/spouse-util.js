/**
 * Shared spouse placement utilities.
 */

export const SPOUSE_GAP = 10; // px between partner cards

/**
 * Compute the X offset for spouse placement.
 *
 * Alternates right/left with increasing distance:
 *   family 0 → right  (1 * offset)
 *   family 1 → left   (-1 * offset)
 *   family 2 → right  (2 * offset)
 *   family 3 → left   (-2 * offset)
 *
 * @param {number} index - Family index (0-based)
 * @param {number} cardWidth
 * @param {number} gap
 * @returns {number} X offset from person position
 */
export function computeSpouseOffset(index, cardWidth, gap) {
    const unit = cardWidth + gap;
    const distance = Math.floor(index / 2) + 1;
    const direction = index % 2 === 0 ? 1 : -1;
    return direction * distance * unit;
}

/**
 * Compute the couple midpoint X offset for a given family index.
 * This is half the spouse offset (the center between person and spouse).
 *
 * @param {number} familyIndex
 * @param {number} cardWidth
 * @param {number} gap
 * @returns {number}
 */
export function coupleMidpointOffset(familyIndex, cardWidth, gap) {
    return computeSpouseOffset(familyIndex, cardWidth, gap) / 2;
}
