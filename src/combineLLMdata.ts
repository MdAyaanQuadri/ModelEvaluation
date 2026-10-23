import * as fs from "node:fs/promises";

type JsonRecord = Record<string, unknown>;

type LLMdata = {
    LeaderBoard: JsonRecord[];
    Models: JsonRecord[];
    Pricing: JsonRecord[];
    Speed: JsonRecord[];
};

 export type CombinedModel = {
    rank: number | null;
    slug: string;
    canonicalModelKey: string;
    model: string;
    creator: string;

    overallScore: number | null;
    coding: number | null;
    agentic: number | null;
    reasoning: number | null;
    knowledge: number | null;
    math: number | null;
    instructionFollowing: number | null;

    inputPrice: number | null;
    outputPrice: number | null;

    tokensPerSecond: number | null;
    ttft: number | null;
};

function asRecord(value: unknown): JsonRecord {
    if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    ) {
        return value as JsonRecord;
    }

    return {};
}

function getObject(
    object: JsonRecord,
    key: string
): JsonRecord {
    return asRecord(object[key]);
}

function getString(
    object: JsonRecord,
    key: string
): string {
    const value = object[key];
    return typeof value === "string" ? value : "";
}

function getNumber(
    object: JsonRecord,
    key: string
): number | null {
    const value = object[key];

    return typeof value === "number" && Number.isFinite(value)
        ? value
        : null;
}

function getArray(
    object: JsonRecord,
    key: string
): JsonRecord[] {
    const value = object[key];

    if (!Array.isArray(value)) {
        throw new Error(`Expected "${key}" to be an array.`);
    }

    return value.map(asRecord);
}

async function readJson(path: string): Promise<JsonRecord> {
    const raw = await fs.readFile(path, "utf8");
    return asRecord(JSON.parse(raw));
}

async function loadLLMData(): Promise<LLMdata> {
    const [
        leaderboardJSON,
        modelsJSON,
        pricingJSON,
        speedJSON
    ] = await Promise.all([
        readJson("../LLMdata/leaderboard.json"),
        readJson("../LLMdata/models.json"),
        readJson("../LLMdata/pricing.json"),
        readJson("../LLMdata/speed.json")
    ]);

    const categories = getObject(leaderboardJSON, "categories");

    return {
        LeaderBoard: getArray(categories, "coding"),
        Models: getArray(modelsJSON, "items"),
        Pricing: getArray(pricingJSON, "items"),
        Speed: getArray(speedJSON, "items")
    };
}

function indexByCanonicalKey(
    records: JsonRecord[]
): Map<string, JsonRecord> {
    const map = new Map<string, JsonRecord>();

    for (const record of records) {
        const key = getString(record, "canonicalModelKey");

        if (key) {
            map.set(key, record);
        }
    }

    return map;
}

async function main(): Promise<void> {
    const data = await loadLLMData();

    const leaderboardMap = indexByCanonicalKey(data.LeaderBoard);
    const pricingMap = indexByCanonicalKey(data.Pricing);
    const speedMap = indexByCanonicalKey(data.Speed);

    const combinedModels: CombinedModel[] = data.Models.map(
        (modelData): CombinedModel => {
            const canonicalModelKey = getString(
                modelData,
                "canonicalModelKey"
            );

            const leaderboard = leaderboardMap.get(canonicalModelKey);
            const pricing = pricingMap.get(canonicalModelKey);
            const speed = speedMap.get(canonicalModelKey);

            const scores = getObject(modelData, "scores");
            const categoryScores = getObject(
                scores,
                "displayCategoryScores"
            );

            return {
                // Rank comes from the coding leaderboard.
                rank: leaderboard
                    ? getNumber(leaderboard, "rank")
                    : null,

                slug: getString(modelData, "slug"),
                canonicalModelKey,
                model: getString(modelData, "model"),
                creator: getString(modelData, "creator"),

                overallScore:
                    getNumber(scores, "overallScore") ??
                    getNumber(modelData, "displayScore"),

                coding: getNumber(categoryScores, "coding"),
                agentic: getNumber(categoryScores, "agentic"),
                reasoning: getNumber(categoryScores, "reasoning"),
                knowledge: getNumber(categoryScores, "knowledge"),
                math: getNumber(categoryScores, "math"),

                instructionFollowing: getNumber(
                    categoryScores,
                    "instructionFollowing"
                ),

                inputPrice: pricing
                    ? getNumber(pricing, "inputPrice")
                    : null,

                outputPrice: pricing
                    ? getNumber(pricing, "outputPrice")
                    : null,

                tokensPerSecond: speed
                    ? getNumber(speed, "tokensPerSecond")
                    : null,

                ttft: speed
                    ? getNumber(speed, "ttft")
                    : null
            };
        }
    );

    const outputPath = "../LLMdata/combined.json";

    await fs.writeFile(
        outputPath,
        JSON.stringify(combinedModels, null, 2),
        "utf8"
    );

    console.log(`Combined models: ${combinedModels.length}`);
    console.log(`Leaderboard records: ${data.LeaderBoard.length}`);
    console.log(`Pricing records: ${data.Pricing.length}`);
    console.log(`Speed records: ${data.Speed.length}`);
    console.log(`Output: ${outputPath}`);
}

main().catch((error: unknown) => {
    console.error("Failed to combine LLM datasets:", error);
    process.exitCode = 1;
});