/**
 * Link/connector drawing utilities.
 *
 * Uses elbow (right-angle) connectors for a clean genealogy look.
 */

/**
 * Draw an elbow link between source and target nodes.
 *
 * @param {d3.Selection} group - SVG group to append the path to
 * @param {object} source - Source node with x, y coordinates
 * @param {object} target - Target node with x, y coordinates
 * @param {string} cssClass - Additional CSS class for the link
 * @param {Configuration} config
 */
export function drawElbowLink(group, source, target, cssClass, config) {
    const halfHeight = config.cardHeight / 2;

    // Midpoint Y between source and target
    const midY = (source.y + target.y) / 2;

    const path = `M ${source.x} ${source.y + (target.y > source.y ? halfHeight : -halfHeight)}
                  L ${source.x} ${midY}
                  L ${target.x} ${midY}
                  L ${target.x} ${target.y + (target.y > source.y ? -halfHeight : halfHeight)}`;

    group
        .append("path")
        .attr("class", `link ${cssClass}`)
        .attr("d", path);
}
