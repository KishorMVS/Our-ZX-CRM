/**
 * Calculate lead score/category.
 * New leads always start at 0.
 * Score is incremented externally (e.g. AI call qualification: +25).
 * This function just computes the category label based on current score.
 * @param {Object} lead
 * @returns {Object} { score, category }
 */
const calculateLeadScore = (lead) => {
    const score = lead.score ?? 0;
    const scoreUpdated = lead.scoreUpdated || false;

    let category = "Cold Lead";
    if (score >= 100) {
        category = "Converted";
    } else if (score >= 80) {
        category = "Hot";
    } else if (score >= 50) {
        category = "Warm";
    } else if (score >= 20) {
        category = "Cold";
    } else if (score > 0) {
        category = "Rejected";
    } else if (score === 0 && scoreUpdated) {
        category = "Not Interested";
    }

    return { score, category };
};

module.exports = calculateLeadScore;
