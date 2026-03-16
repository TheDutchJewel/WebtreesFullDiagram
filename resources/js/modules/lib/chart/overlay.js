/**
 * Bio card tooltip on hover.
 *
 * Shows: full name, profile photo, birth, baptism, marriage, death,
 * occupation, residence, current age (if alive) or age at death.
 *
 * Uses window.fullDiagramI18n for translated labels.
 */
import { select } from "../d3.js";

let activeTooltip = null;
let activePersonId = null;
let hideTimer = null;

/** Get a translated string, with optional substitution. */
function t(key, ...args) {
    const i18n = window.fullDiagramI18n || {};
    let str = i18n[key] || key;
    for (const arg of args) {
        str = str.replace("__AGE__", arg);
    }
    return str;
}

/**
 * Show a bio card tooltip for a person.
 *
 * @param {object} data - Person data
 * @param {SVGElement} cardElement - The SVG card group element
 * @param {string} containerSelector
 * @param {Function} [onFocus] - Optional callback to focus this person in the diagram
 * @param {string} [personId] - Person ID for the focus callback
 */
export function showBioCard(data, cardElement, containerSelector, onFocus, personId) {
    // Toggle: tapping the same card again dismisses the tooltip
    if (activeTooltip && activePersonId === personId) {
        hideTooltip();
        return;
    }
    hideTooltip();

    const container = select(containerSelector);
    const containerRect = container.node().getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    // Position tooltip below the card, centered
    const left = cardRect.left - containerRect.left + cardRect.width / 2;
    const top = cardRect.bottom - containerRect.top + 8;

    const tooltip = container
        .append("div")
        .attr("class", "bio-card")
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .style("transform", "translateX(-50%)")
        .on("mouseenter", () => clearTimeout(hideTimer))
        .on("mouseleave", () => scheduleHide());

    // Header: photo + name
    const header = tooltip.append("div").attr("class", "bio-header");

    if (data.avatar) {
        header
            .append("img")
            .attr("src", data.avatar)
            .attr("alt", data.fullName || "")
            .attr("class", "bio-photo");
    }

    const headerText = header.append("div").attr("class", "bio-header-text");
    headerText.append("div").attr("class", "bio-name").text(data.fullName || "???");

    // Age
    const ageText = computeAge(data);
    if (ageText) {
        headerText.append("div").attr("class", "bio-age").text(ageText);
    }

    // Facts list
    const facts = tooltip.append("div").attr("class", "bio-facts");

    addFact(facts, t("Born"), data.birthDate, data.birthPlace);
    addFact(facts, t("Baptism"), data.baptismDate);
    addFact(facts, t("Marriage"), data.marriageDate);
    addFact(facts, t("Died"), data.deathDate, data.deathPlace);
    addFact(facts, t("Occupation"), data.occupation);
    addFact(facts, t("Residence"), data.residence);

    // Action buttons — top-right corner
    const actions = tooltip.append("div").attr("class", "bio-actions");

    // Focus in diagram button (navigates the chart to this person)
    if (onFocus && personId) {
        actions
            .append("button")
            .attr("type", "button")
            .attr("class", "bio-action-btn bio-focus-btn")
            .attr("title", t("Focus in diagram"))
            .html(
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="11" cy="11" r="8"/>' +
                '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
                '<line x1="11" y1="8" x2="11" y2="14"/>' +
                '<line x1="8" y1="11" x2="14" y2="11"/>' +
                '</svg>'
            )
            .on("click", () => {
                hideTooltip();
                onFocus({ id: personId, data });
            });
    }

    // View profile button (goes to webtrees individual page)
    if (data.url) {
        actions
            .append("a")
            .attr("href", data.url)
            .attr("class", "bio-action-btn bio-profile-btn")
            .attr("title", t("View profile"))
            .html(
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
                '<polyline points="15 3 21 3 21 9"/>' +
                '<line x1="10" y1="14" x2="21" y2="3"/>' +
                '</svg>'
            );
    }

    activeTooltip = tooltip;
    activePersonId = personId || null;
}

function addFact(container, label, value, place) {
    if (!value && !place) return;

    const row = container.append("div").attr("class", "bio-fact");
    row.append("span").attr("class", "bio-fact-label").text(label);

    let display = value || "";
    if (place) {
        display += display ? `, ${place}` : place;
    }
    row.append("span").attr("class", "bio-fact-value").text(display);
}

/**
 * Try to parse a webtrees display date string into a Date object.
 * Handles formats like "15 March 1985", "March 1985", "1985".
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return null;
}

function computeAge(data) {
    if (!data.birthYear) return "";

    const birthYear = parseInt(data.birthYear, 10);
    if (isNaN(birthYear)) return "";

    if (data.isDead) {
        // Try precise calculation from full dates
        const birthDate = parseDate(data.birthDate);
        const deathDate = parseDate(data.deathDate);
        if (birthDate && deathDate) {
            let age = deathDate.getFullYear() - birthDate.getFullYear();
            const monthDiff = deathDate.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && deathDate.getDate() < birthDate.getDate())) {
                age--;
            }
            return t("Died at age %s", age);
        }
        // Fallback to year-based
        if (data.deathYear) {
            const deathYear = parseInt(data.deathYear, 10);
            if (!isNaN(deathYear)) {
                return t("Died at age %s", deathYear - birthYear);
            }
        }
        return t("Deceased");
    }

    // Living person — try precise calculation
    const birthDate = parseDate(data.birthDate);
    const now = new Date();
    if (birthDate) {
        let age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
            age--;
        }
        return t("Age ~%s", age);
    }

    // Fallback to year-based approximation
    const age = now.getFullYear() - birthYear;
    return t("Age ~%s", age);
}

function scheduleHide() {
    hideTimer = setTimeout(hideTooltip, 300);
}

/**
 * Hide the active tooltip.
 */
export function hideTooltip() {
    clearTimeout(hideTimer);
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
        activePersonId = null;
    }
}

/**
 * Attach hover behavior to a person card group.
 *
 * @param {d3.Selection} cardGroup - The SVG <g> for the person card
 * @param {object} data - Person data
 * @param {string} containerSelector
 * @param {Function} [onFocus] - Optional callback to focus this person in the diagram
 * @param {string} [personId] - Person ID for the focus callback
 */
export function attachHoverBioCard(cardGroup, data, containerSelector, onFocus, personId) {
    cardGroup
        .on("mouseenter", function () {
            clearTimeout(hideTimer);
            showBioCard(data, this, containerSelector, onFocus, personId);
        })
        .on("mouseleave", () => {
            scheduleHide();
        });
}
