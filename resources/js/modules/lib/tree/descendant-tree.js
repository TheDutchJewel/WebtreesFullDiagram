/**
 * Descendant tree rendering.
 *
 * Key design: children descend from *both* parents. A horizontal connector
 * joins the couple, and the vertical drop to children originates from the
 * midpoint of that connector — not from a single parent.
 *
 * Multiple spouses are placed alternating left/right with increasing distance
 * to avoid overlap between family branches.
 */
import { renderPersonCard } from "../chart/box.js";
import { computeSpouseOffset, SPOUSE_GAP } from "./spouse-util.js";

/**
 * Render the descendant tree: nodes, spouse nodes, and couple-centered links.
 */
export function renderDescendantTree(canvas, nodes, _links, rootData, config, onNodeClick, containerSelector) {
    const linkGroup = canvas.append("g").attr("class", "descendant-links");
    const nodeGroup = canvas.append("g").attr("class", "descendant-nodes");

    // Build a map of xref → D3 node position for all descendant nodes + root
    const posMap = new Map();
    posMap.set(rootData.xref, { x: 0, y: 0 });
    for (const node of nodes) {
        posMap.set(node.data.xref, { x: node.x, y: node.y });
    }

    // Render all descendant person cards
    for (const node of nodes) {
        renderPersonCard(nodeGroup, node, config, onNodeClick, containerSelector);
    }

    // Render spouses and couple-centered links at every level (including root)
    const allPersons = [rootData, ...nodes.map((n) => n.data)];
    for (const person of allPersons) {
        renderCoupleLinks(linkGroup, nodeGroup, person, posMap, config, onNodeClick, containerSelector);
    }
}

/**
 * For a person with families, render each spouse and draw the
 * couple → children connector.
 *
 * Multiple spouses alternate left (odd index) / right (even index)
 * with increasing distance.
 */
function renderCoupleLinks(linkGroup, nodeGroup, personData, posMap, config, onNodeClick, containerSelector) {
    if (!personData.families || personData.families.length === 0) return;

    const personPos = posMap.get(personData.xref);
    if (!personPos) return;

    const w = config.cardWidth;
    const h = config.cardHeight;
    const halfH = h / 2;

    personData.families.forEach((family, familyIndex) => {
        // Alternate spouse placement: first right, second left, third further right, etc.
        const spouseOffset = computeSpouseOffset(familyIndex, w, SPOUSE_GAP);

        let spousePos = null;

        if (family.spouse) {
            spousePos = {
                x: personPos.x + spouseOffset,
                y: personPos.y,
            };

            // Render spouse card
            renderPersonCard(
                nodeGroup,
                { x: spousePos.x, y: spousePos.y, data: family.spouse },
                config,
                onNodeClick,
                containerSelector
            );

            // Horizontal connector between the couple (edge-to-edge)
            const leftX = Math.min(personPos.x, spousePos.x);
            const rightX = Math.max(personPos.x, spousePos.x);

            linkGroup
                .append("line")
                .attr("class", "link spouse-link")
                .attr("x1", leftX + w / 2)
                .attr("y1", personPos.y)
                .attr("x2", rightX - w / 2)
                .attr("y2", personPos.y);
        }

        // Collect children positions for this family
        const childPositions = [];
        for (const child of family.children || []) {
            const childPos = posMap.get(child.xref);
            if (childPos) {
                childPositions.push(childPos);
            }
        }

        if (childPositions.length === 0) return;

        // Couple midpoint X (centered between parents)
        const coupleX = spousePos
            ? (personPos.x + spousePos.x) / 2
            : personPos.x;

        // Y coordinates: bottom of parent card → top of child card
        const parentBottomY = personPos.y + halfH;
        const childTopY = childPositions[0].y - halfH;

        // Horizontal rail sits 40% of the way down from parent to child
        const railY = parentBottomY + (childTopY - parentBottomY) * 0.4;

        // 1. Vertical line: couple bottom → rail
        linkGroup
            .append("line")
            .attr("class", "link descendant-link")
            .attr("x1", coupleX)
            .attr("y1", parentBottomY)
            .attr("x2", coupleX)
            .attr("y2", railY);

        // 2. Horizontal rail spanning all children
        const xs = childPositions.map((c) => c.x);
        const minX = Math.min(coupleX, ...xs);
        const maxX = Math.max(coupleX, ...xs);

        linkGroup
            .append("line")
            .attr("class", "link descendant-link")
            .attr("x1", minX)
            .attr("y1", railY)
            .attr("x2", maxX)
            .attr("y2", railY);

        // 3. Vertical drops: rail → top of each child card
        for (const cp of childPositions) {
            linkGroup
                .append("line")
                .attr("class", "link descendant-link")
                .attr("x1", cp.x)
                .attr("y1", railY)
                .attr("x2", cp.x)
                .attr("y2", childTopY);
        }
    });
}

// Re-export from shared utility
export { computeSpouseOffset } from "./spouse-util.js";
