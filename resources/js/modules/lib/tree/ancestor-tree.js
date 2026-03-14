/**
 * Ancestor tree rendering — draws ancestor nodes and links upward from root.
 */
import { renderPersonCard } from "../chart/box.js";
import { drawElbowLink } from "./link-drawer.js";

/**
 * Render the ancestor tree nodes and links.
 *
 * @param {d3.Selection} canvas - The SVG canvas group
 * @param {Array} nodes - Ancestor hierarchy nodes (from computeLayout)
 * @param {Array} links - Ancestor hierarchy links
 * @param {Configuration} config
 * @param {Function} onNodeClick
 * @param {string} containerSelector
 */
export function renderAncestorTree(canvas, nodes, links, config, onNodeClick, containerSelector) {
    // Draw links first (behind nodes)
    const linkGroup = canvas.append("g").attr("class", "ancestor-links");

    for (const link of links) {
        drawElbowLink(linkGroup, link.source, link.target, "ancestor-link", config);
    }

    // Draw nodes
    const nodeGroup = canvas.append("g").attr("class", "ancestor-nodes");

    for (const node of nodes) {
        renderPersonCard(nodeGroup, node, config, onNodeClick, containerSelector);
    }
}
