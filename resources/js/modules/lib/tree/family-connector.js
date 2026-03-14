/**
 * Family connector utilities.
 *
 * Draws special connectors between spouses and from couples to children.
 */

/**
 * Draw a family connector: horizontal line between spouses,
 * then vertical drop to children.
 *
 * @param {d3.Selection} group
 * @param {object} parent1 - First parent position {x, y}
 * @param {object} parent2 - Second parent position {x, y}
 * @param {Array} children - Child positions [{x, y}, ...]
 * @param {Configuration} config
 */
export function drawFamilyConnector(group, parent1, parent2, children, config) {
    const halfHeight = config.cardHeight / 2;

    // Horizontal line between spouses
    if (parent2) {
        group
            .append("line")
            .attr("class", "link spouse-link")
            .attr("x1", parent1.x)
            .attr("y1", parent1.y)
            .attr("x2", parent2.x)
            .attr("y2", parent2.y)
            .attr("stroke", "#d4a87b")
            .attr("stroke-width", 2);
    }

    if (children.length === 0) return;

    // Midpoint between parents (or just parent1 if single parent)
    const coupleX = parent2 ? (parent1.x + parent2.x) / 2 : parent1.x;
    const coupleY = parent1.y + halfHeight;

    // Vertical drop from couple midpoint
    const childrenY = children[0].y - halfHeight;
    const midY = (coupleY + childrenY) / 2;

    group
        .append("line")
        .attr("class", "link descendant-link")
        .attr("x1", coupleX)
        .attr("y1", coupleY)
        .attr("x2", coupleX)
        .attr("y2", midY);

    if (children.length === 1) {
        // Single child — straight line down
        group
            .append("line")
            .attr("class", "link descendant-link")
            .attr("x1", coupleX)
            .attr("y1", midY)
            .attr("x2", children[0].x)
            .attr("y2", childrenY);
    } else {
        // Multiple children — horizontal rail
        const minX = Math.min(...children.map((c) => c.x));
        const maxX = Math.max(...children.map((c) => c.x));

        group
            .append("line")
            .attr("class", "link descendant-link")
            .attr("x1", minX)
            .attr("y1", midY)
            .attr("x2", maxX)
            .attr("y2", midY);

        for (const child of children) {
            group
                .append("line")
                .attr("class", "link descendant-link")
                .attr("x1", child.x)
                .attr("y1", midY)
                .attr("x2", child.x)
                .attr("y2", childrenY);
        }
    }
}
