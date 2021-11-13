# Recipe Keeper To Paprika
Import recipes from [Recipe Keeper 3](https://www.recipekeeperonline.com) to [Paprika 3](https://www.paprikaapp.com).

## Installation
Run `npm install`.

## Usage
1. Export your recipes from Recipe Keeper to a ZIP file (you can do this from the settings).
2. Extract the ZIP to the root of this project and rename the folder `RecipeKeeper`.
3. Run `node index.mjs` from the root of this project. This will create a file in the `Output` folder called `recipes.yml`.
4. Import this file into Paprika. On the Mac version you can do this from the File menu.

## Notes
- Courses and categories are combined. For example, if a recipe has the courses **Lunch** and **Dinner** and the category **Pasta**, the imported recipe will have the categories **Lunch - Pasta** and **Dinner - Pasta**.
- Collections are turned into categories with **(Collection)** added to the front.
- Favorites are added to a category called **(Favorites)**.
- Only the first photo in a recipe is included.
- Linked recipes are not included.