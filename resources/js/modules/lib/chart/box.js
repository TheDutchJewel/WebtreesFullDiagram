/**
 * Person card (box) renderer.
 *
 * Shows first + last name (middle names dropped to save space).
 * Profile picture displayed if available, otherwise a gendered silhouette.
 * Hover shows a rich bio card with dates, places, occupation, age.
 */
import { attachHoverBioCard } from "./overlay.js";

/**
 * Render a person card as an SVG group.
 *
 * @param {d3.Selection} parent - The parent SVG group to append to
 * @param {object} person - { x, y, id, isMain, data: { gender, "first name", ... } }
 * @param {object} config
 * @param {Function} onClick - Click handler receiving { id, data }
 * @param {string} containerSelector - Selector for the chart container (for tooltip positioning)
 * @returns {d3.Selection}
 */
export function renderPersonCard(parent, person, config, onClick, containerSelector) {
    const data = person.data;
    const w = config.cardWidth;
    const h = config.cardHeight;

    const sexClass = `sex-${(data.gender || "u").toLowerCase()}`;
    const rootClass = person.isMain ? "is-root" : "";

    const g = parent
        .append("g")
        .attr("class", `person-card ${sexClass} ${rootClass}`.trim())
        .attr("transform", `translate(${person.x - w / 2}, ${person.y - h / 2})`)
        .style("cursor", "pointer")
        .on("click", (event) => {
            event.stopPropagation();
            onClick({ id: person.id, data });
        });

    // Card background
    g.append("rect")
        .attr("width", w)
        .attr("height", h)
        .attr("rx", 8)
        .attr("ry", 8);

    // Photo area (left side)
    const photoSize = 50;
    const photoX = 8;
    const photoY = (h - photoSize) / 2;
    const textXOffset = photoX + photoSize + 10;

    // Clip path for circular photo
    const clipId = `clip-${person.id}-${Math.random().toString(36).slice(2, 8)}`;
    g.append("clipPath")
        .attr("id", clipId)
        .append("circle")
        .attr("cx", photoX + photoSize / 2)
        .attr("cy", photoY + photoSize / 2)
        .attr("r", photoSize / 2 - 2);

    if (data.avatar) {
        // Profile picture
        g.append("image")
            .attr("href", data.avatar)
            .attr("x", photoX)
            .attr("y", photoY)
            .attr("width", photoSize)
            .attr("height", photoSize)
            .attr("preserveAspectRatio", "xMidYMid slice")
            .attr("clip-path", `url(#${clipId})`);
    } else {
        // Silhouette placeholder circle
        g.append("circle")
            .attr("cx", photoX + photoSize / 2)
            .attr("cy", photoY + photoSize / 2)
            .attr("r", photoSize / 2 - 2)
            .attr("class", "photo-placeholder");

        // Simple silhouette icon
        const cx = photoX + photoSize / 2;
        const cy = photoY + photoSize / 2;
        // Head
        g.append("circle")
            .attr("cx", cx)
            .attr("cy", cy - 6)
            .attr("r", 8)
            .attr("class", "silhouette");
        // Body
        g.append("ellipse")
            .attr("cx", cx)
            .attr("cy", cy + 14)
            .attr("rx", 12)
            .attr("ry", 9)
            .attr("class", "silhouette");
    }

    // Name: first + last (drop middle names)
    const firstName = data["first name"] || "";
    const lastName = data["last name"] || "";
    const displayName = formatDisplayName(firstName, lastName, data.fullName);
    const maxTextWidth = w - textXOffset - 8;

    g.append("text")
        .attr("class", "person-name")
        .attr("x", textXOffset)
        .attr("y", h / 2 - 10)
        .text(truncateText(displayName, maxTextWidth));

    // Dates line
    const dates = formatDates(data.birthYear, data.deathYear, data.isDead);
    if (dates) {
        g.append("text")
            .attr("class", "person-dates")
            .attr("x", textXOffset)
            .attr("y", h / 2 + 6)
            .text(dates);
    }

    // Occupation as a third line
    const subtitle = data.occupation || "";
    if (subtitle) {
        g.append("text")
            .attr("class", "person-subtitle")
            .attr("x", textXOffset)
            .attr("y", h / 2 + 20)
            .text(truncateText(subtitle, maxTextWidth));
    }

    // "More ancestors" indicator — two small parent boxes at top-right
    if (data.hasMoreAncestors) {
        const ig = g.append("g").attr("class", "more-ancestors-indicator");

        const bw = 10, bh = 7, gap = 4;
        const cx = w - 25;
        const topY = -14;
        const leftX = cx - gap / 2 - bw;
        const rightX = cx + gap / 2;
        const barY = topY + bh;

        // Lines first (behind boxes)
        ig.append("line")
            .attr("x1", leftX + bw / 2).attr("y1", barY)
            .attr("x2", rightX + bw / 2).attr("y2", barY);
        ig.append("line")
            .attr("x1", cx).attr("y1", barY)
            .attr("x2", cx).attr("y2", 0);

        // Boxes on top
        ig.append("rect")
            .attr("x", leftX).attr("y", topY)
            .attr("width", bw).attr("height", bh)
            .attr("rx", 2).attr("ry", 2);
        ig.append("rect")
            .attr("x", rightX).attr("y", topY)
            .attr("width", bw).attr("height", bh)
            .attr("rx", 2).attr("ry", 2);
    }

    // "More descendants" indicator — two small child boxes at bottom-right
    if (data.hasMoreDescendants) {
        const ig = g.append("g").attr("class", "more-descendants-indicator");

        const bw = 10, bh = 7, gap = 4;
        const cx = w - 25;
        const boxTop = h + 7; // below card bottom edge
        const leftX = cx - gap / 2 - bw;
        const rightX = cx + gap / 2;
        const barY = boxTop; // bar at top of boxes

        // Lines first (behind boxes)
        ig.append("line")
            .attr("x1", cx).attr("y1", h)
            .attr("x2", cx).attr("y2", barY);
        ig.append("line")
            .attr("x1", leftX + bw / 2).attr("y1", barY)
            .attr("x2", rightX + bw / 2).attr("y2", barY);

        // Boxes on top
        ig.append("rect")
            .attr("x", leftX).attr("y", boxTop)
            .attr("width", bw).attr("height", bh)
            .attr("rx", 2).attr("ry", 2);
        ig.append("rect")
            .attr("x", rightX).attr("y", boxTop)
            .attr("width", bw).attr("height", bh)
            .attr("rx", 2).attr("ry", 2);
    }

    // Attach hover bio card
    if (containerSelector) {
        attachHoverBioCard(g, data, containerSelector);
    }

    return g;
}

/**
 * Format display name: first name + last name, dropping middle names.
 * Handles GEDCOM placeholders: @N.N. = unknown name, @P.N. = unknown given name
 */
function formatDisplayName(firstName, lastName, fullName) {
    // Clean GEDCOM unknown-name placeholders
    const cleanFirst = firstName && !firstName.match(/^@[A-Z]\.N\.$/) ? firstName : "";
    const cleanLast = lastName && !lastName.match(/^@[A-Z]\.N\.$/) ? lastName : "";

    if (!cleanFirst && !cleanLast) {
        // Also clean fullName of @N.N. patterns
        const cleanFull = fullName ? fullName.replace(/@[A-Z]\.N\./g, "\u2026").trim() : "";
        return cleanFull || "???";
    }

    // Take only the first given name (drop middle names)
    const firstOnly = cleanFirst ? cleanFirst.split(/\s+/)[0] : "";

    if (firstOnly && cleanLast) {
        return `${firstOnly} ${cleanLast}`;
    }

    return firstOnly || cleanLast || "???";
}

function truncateText(text, maxWidth) {
    // ~7px per character at 12px font
    const maxChars = Math.floor(maxWidth / 7);
    if (!text || text.length <= maxChars) return text || "";
    return text.substring(0, maxChars - 1) + "\u2026";
}

function formatDates(birth, death, isDead) {
    if (!birth && !death) return "";
    if (birth && death) return `${birth}\u2013${death}`;
    if (birth && isDead) return `${birth}\u2013?`;
    if (birth) return `* ${birth}`;
    return `\u2020 ${death}`;
}
