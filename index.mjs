import { Buffer } from "buffer";
import fs from "fs";
import * as humanizer_import from "humanize-duration";
import * as yaml_import from "js-yaml";
import { Duration } from "luxon";
import { parse } from "node-html-parser";
import path from "path";
import * as turndown_import from "turndown";
import { URL } from "url";

const humanizer = humanizer_import.default;
const TurndownService = turndown_import.default;
const yaml = yaml_import.default;

TurndownService.prototype.escape = text => text;
const turndownService = new TurndownService({
    strongDelimiter: "*",
});
turndownService.addRule("blank-paragraphs", {
    filter: "p",
    replacement(content) {
        // extra line break before ingredient headers
        if (content.endsWith(":")) return `\n\n${content}\n`;
        return `${content}\n`;
    },
});

const nutritionData = [
    // tag name, output name, unit
    ["Calories", "Calories", ""],
    ["TotalFat", "Total Fat", "g"],
    ["SaturatedFat", "Saturated Fat", "g"],
    ["Cholesterol", "Cholesterol", "mg"],
    ["Sodium", "Sodium", "mg"],
    ["TotalCarbohydrate", "Total Carbohydrate", "g"],
    ["DietaryFiber", "Dietary Fiber", "g"],
    ["Sugars", "Sugars", "g"],
    ["Protein", "Protein", "g"],
];

const rkDir = "./RecipeKeeper";
const outputDir = "./Output";

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const rkHTML = fs.readFileSync(path.join(rkDir, "recipes.html"), {
    encoding: "utf-8",
});

const rkDOM = parse(rkHTML);
const rkRecipes = rkDOM.querySelectorAll(".recipe-details");

const paprikaRecipes = rkRecipes.map(rkRecipe => {
    const pRecipe = {
        name: rkRecipe.querySelector('[itemprop="name"]').textContent,
        servings: rkRecipe
            .querySelector('[itemprop="recipeYield"]')
            .textContent.replace(/servings:?/i, "")
            .trim(),
        source: undefined,
        source_url: undefined,
        prep_time: undefined,
        cook_time: undefined,
        on_favorites:
            rkRecipe
                .querySelector('[itemprop="recipeIsFavourite"]')
                .getAttribute("content") === "True"
                ? "yes"
                : "no",
        categories: [],
        nutritional_info: undefined,
        difficulty: undefined,
        rating:
            parseInt(
                rkRecipe
                    .querySelector('[itemprop="recipeRating"]')
                    .getAttribute("content")
            ) ?? 0,
        notes: turndownService.turndown(
            rkRecipe.querySelector('[itemprop="recipeNotes"]').innerHTML
        ),
        photo: undefined,
        ingredients: turndownService.turndown(
            rkRecipe.querySelector('[itemprop="recipeIngredients"]').innerHTML
        ),
        directions: turndownService.turndown(
            rkRecipe.querySelector('[itemprop="recipeDirections"]').innerHTML
        ),
    };

    /* Nutrition Info */
    const nutrition = [];
    nutritionData.forEach(([key, name, unit]) => {
        const nutEl = rkRecipe.querySelector(`[itemprop="recipeNut${key}"]`);
        if (nutEl && nutEl.getAttribute("content")) {
            nutrition.push(`${name}: ${nutEl.getAttribute("content")}${unit}`);
        }
    });
    pRecipe.nutritional_info = nutrition.join("\n");

    /* Source */
    const source = rkRecipe.querySelector('[itemprop="recipeSource"]');
    if (source.querySelector("a")) {
        pRecipe.source_url = source.querySelector("a").getAttribute("href");
        // remove www to match Paprika's recipe importer
        pRecipe.source = new URL(pRecipe.source_url).hostname.replace(
            "www.",
            ""
        );
    } else {
        pRecipe.source = source.textContent;
    }

    /* Categories */
    const courses = rkRecipe
        .querySelectorAll('[itemprop="recipeCourse"]')
        .map(el => {
            return el.getAttribute("content") ?? el.textContent;
        });
    const categories = rkRecipe
        .querySelectorAll('[itemprop="recipeCategory"]')
        .map(el => {
            return el.getAttribute("content") ?? el.textContent;
        });

    courses.forEach(course => {
        if (categories.length) {
            categories.forEach(category => {
                pRecipe.categories.push(`${course} - ${category}`);
            });
        } else {
            pRecipe.categories.push(`${course}`);
        }
    });

    const collections = rkRecipe
        .querySelectorAll('[itemprop="recipeCollection"]')
        .map(el => {
            return el.getAttribute("content") ?? el.textContent;
        });
    collections.forEach(collection =>
        pRecipe.categories.push(`(Collection) ${collection}`)
    );

    // Paprika does not seem to respect the on_favorites key
    if (pRecipe.on_favorites === "yes") {
        pRecipe.categories.push("(Favorites)");
    }

    /* Times */
    Object.assign(
        pRecipe,
        parseTimes(
            rkRecipe
                .querySelector('[itemprop="prepTime"]')
                .getAttribute("content"),
            rkRecipe
                .querySelector('[itemprop="cookTime"]')
                .getAttribute("content")
        )
    );

    /* Photo */
    const photoEl = rkRecipe.querySelector(".recipe-photos-div img");
    if (photoEl) {
        const imagePath = photoEl.getAttribute("src");
        const imageData = fs.readFileSync(path.join(rkDir, imagePath));
        pRecipe.photo = Buffer.from(imageData).toString("base64");
    }

    return pRecipe;
});

fs.writeFileSync(
    path.join(outputDir, "recipes.yml"),
    yaml.dump(paprikaRecipes, {
        lineWidth: -1,
        noCompatMode: true,
    })
);

function parseTimes(prepTimeRaw, cookTimeRaw) {
    const [prepTime, cookTime] = [prepTimeRaw, cookTimeRaw].map(
        Duration.fromISO
    );
    const totalTime = prepTime.plus(cookTime);

    const times = {};
    const humanizerOptions = { delimiter: " " };

    if (prepTime.toMillis() > 0) {
        times.prep_time = humanizer(prepTime.toMillis(), humanizerOptions);
    }
    if (cookTime.toMillis() > 0) {
        times.cook_time = humanizer(cookTime.toMillis(), humanizerOptions);
    }
    if (totalTime.toMillis() > 0) {
        times.total_time = humanizer(totalTime.toMillis(), humanizerOptions);
    }

    return times;
}
