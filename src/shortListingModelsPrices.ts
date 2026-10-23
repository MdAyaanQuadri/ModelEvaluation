import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CombinedModel } from "./combineLLMdata.js";

// Resolve paths relative to this script.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDirectory = path.resolve(__dirname, "../LLMdata");

async function main(): Promise<void> {
    // Read the combined model dataset.
    const rawCombinedDataModel = await fs.readFile(
        path.join(dataDirectory, "combined.json"),
        "utf8"
    );

    const combinedDataModel: CombinedModel[] =
        JSON.parse(rawCombinedDataModel);

    // Maximum estimated monthly cost.
    const priceLimitPerMonth = 200;

    // Usage assumptions.
    const avgInputToken = 400;
    const avgOutputToken = 150;
    const requestsPerDay = 500;
    const dollartoinr = 95 ;
    const daysPerMonth = 30;

    const shortlistedModels: CombinedModel[] = [];

    for (const model of combinedDataModel) {
        // Exclude models with missing pricing information.
        // Zero-priced models are allowed.
        if (
            model.inputPrice == null ||
            model.outputPrice == null ||
            model.rank == null
        ) {
            continue;
        }

        // Assumes inputPrice and outputPrice are USD per
        // 1 million tokens.
        const costPerRequest =
            (
                model.inputPrice * avgInputToken +
                model.outputPrice * avgOutputToken
            ) / 1_000_000;

        const monthlyCost =
            costPerRequest * requestsPerDay * daysPerMonth * dollartoinr;

        if (monthlyCost <= priceLimitPerMonth) {
            shortlistedModels.push(model);
        }
    }

    // Write the shortlisted models.
    const outputPath = path.join(
        dataDirectory,
        "shortListedByPriceModels.json"
    );
    shortlistedModels.sort((a, b) => {
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;

});
    await fs.writeFile(
        outputPath,
        JSON.stringify(shortlistedModels, null, 2),
        "utf8"
    );

    console.log(`Total models: ${combinedDataModel.length}`);
    console.log(`Models within budget: ${shortlistedModels.length}`);
    console.log(`Monthly budget: ${priceLimitPerMonth}`);
    console.log(`Output: ${outputPath}`);
}

main().catch((error: unknown) => {
    console.error("Failed to shortlist models by price:", error);
    process.exitCode = 1;
});