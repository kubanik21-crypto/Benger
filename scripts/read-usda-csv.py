"""Build-time only: streaming official USDA CSV ZIP, not a runtime dependency."""
import csv, io, json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    names={name.split('/')[-1]:name for name in archive.namelist()}
    def rows(name):
        if name not in names: return iter([])
        return csv.DictReader(io.TextIOWrapper(archive.open(names[name]),encoding='utf-8-sig'))
    categories={row['id']:row['description'] for row in rows('food_category.csv')}
    foods={row['fdc_id']:{'fdcId':int(row['fdc_id']),'description':row['description'],'dataType':row.get('data_type'), 'foodCategory':categories.get(row.get('food_category_id'),'Unknown'),'foodNutrients':[]} for row in rows('food.csv')}
    # Survey uses WWEIA categories in separate association tables.
    survey_categories={}
    for row in rows('wweia_food_category.csv'):
        code=[key for key in row if 'code' in key.lower()]
        description=[key for key in row if 'description' in key.lower()]
        if len(code)==1 and len(description)==1: survey_categories[row[code[0]]]=row[description[0]]
    for row in rows('survey_fndds_food.csv'):
        code=[key for key in row if 'wweia' in key.lower() and 'code' in key.lower()]
        if len(code)==1 and row.get('fdc_id') in foods and row[code[0]] in survey_categories:
            foods[row['fdc_id']]['foodCategory']=survey_categories[row[code[0]]]
    # Nutrient IDs: protein=1003, fat=1004, carbohydrate=1005, kcal=1008;
    # Atwater specific/general=2048/2047 are kcal alternatives, not kJ.
    wanted={'1003','1004','1005','1008','2047','2048'}
    # FNDDS 2019–2020 CSV uses legacy nutrient numbers (confirmed in official export).
    legacy={'203':'1003','204':'1004','205':'1005','208':'1008'}
    observed=[]; sample=None
    for row in rows('food_nutrient.csv'):
        if sample is None: sample=row
        if row['nutrient_id'] not in observed and len(observed)<20: observed.append(row['nutrient_id'])
        nutrient_id=legacy.get(row['nutrient_id'],row['nutrient_id'])
        if nutrient_id in wanted and row['fdc_id'] in foods:
            foods[row['fdc_id']]['foodNutrients'].append({'nutrient':{'id':int(nutrient_id)},'amount':row.get('amount')})
    first=next(iter(foods.values()))
    first['importDiagnostics']={'nutrientIds':observed,'firstNutrientRow':sample,'surveyCategoryRows':len(survey_categories),'tables':list(names)}
    print(json.dumps(list(foods.values()),ensure_ascii=False))
