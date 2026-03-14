/**
 * Sibling node layout and rendering.
 *
 * Siblings are placed at the same Y-level as the root, to the left.
 * Connected via T-junction from the parent link.
 */
import { renderPersonCard } from "../chart/box.js";

/**
 * Render sibling nodes and their connectors.
 *
 * @param {d3.Selection} canvas
 * @param {Array} siblings - Sibling position data from computeSiblingPositions
 * @param {Array} links - Sibling links
 * @param {Configuration} config
 * @param {Function} onNodeClick
 * @param {string} containerSelector
 */
export function renderSiblings(canvas, siblings, links, config, onNodeClick, containerSelector) {
    if (siblings.length === 0) return;

    const siblingGroup = canvas.append("g").attr("class", "sibling-nodes");
    const linkGroup = canvas.append("g").attr("class", "sibling-links");

    // Draw a horizontal rail connecting all siblings + root
    const minX = 0;
    const maxX = siblings[siblings.length - 1].x;
    const railY = -config.cardHeight / 2 - 15;

    // Vertical connector from parent area to rail
    linkGroup
        .append("line")
        .attr("class", "link sibling-link")
        .attr("x1", 0)
        .attr("y1", -config.cardHeight / 2)
        .attr("x2", 0)
        .attr("y2", railY);

    // Horizontal rail
    linkGroup
        .append("line")
        .attr("class", "link sibling-link")
        .attr("x1", minX)
        .attr("y1", railY)
        .attr("x2", maxX)
        .attr("y2", railY);

    // Vertical drops from rail to each sibling
    for (const sibling of siblings) {
        linkGroup
            .append("line")
            .attr("class", "link sibling-link")
            .attr("x1", sibling.x)
            .attr("y1", railY)
            .attr("x2", sibling.x)
            .attr("y2", sibling.y - config.cardHeight / 2);

        renderPersonCard(siblingGroup, sibling, config, onNodeClick, containerSelector);
    }
}
