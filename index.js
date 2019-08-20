module.exports = json_input => {
    try {
        const valid_json = JSON.parse(json_input);

        const select = generate_select(valid_json);
        const filter = generate_filter(valid_json);
        const sql = `
                    SELECT ${select} 
                    FROM "Dataset" inner join "Run" 
                    ON "Dataset"."run_number" = "Run"."run_number" 
                    INNER JOIN "DatasetTripletCache" 
                    ON "Dataset"."run_number" = "DatasetTripletCache"."run_number" 
                    AND "Dataset"."name" = "DatasetTripletCache"."name"
                    WHERE ${filter}
                    `;
    } catch (err) {
        console.log('Unvalid JSON');
        throw err;
    }
};
const generate_select = json => {
    return '*';
};

const generate_filter = json => {
    for (const [key, val] of Object.entries(json)) {
        switch (key) {
            case 'and': {
                // validate and
                if (!Array.isArray(val)) {
                    throw `Property 'and' must have an array`;
                }
                if (val.length === 1) {
                    return ` (${generate_filter(val[0])}) `;
                } else {
                    let generated_string = '';
                    val.forEach((cond, index) => {
                        generated_string += `(${generate_filter(cond)})`;
                        if (index !== val.length - 1) {
                            generated_string += ' AND ';
                        }
                    });
                    return generated_string;
                }
            }
            case 'or': {
                // validate or
                if (!Array.isArray(val)) {
                    throw `Property 'and' must have an array`;
                }
                if (val.length === 1) {
                    return `(${generate_filter(val[0])})`;
                } else {
                    let generated_string = '';
                    val.forEach((cond, index) => {
                        generated_string += `(${generate_filter(cond)})`;
                        if (index !== val.length - 1) {
                            generated_string += ' OR ';
                        }
                    });
                    return generated_string;
                }
            }
            case '==':
            case '>=':
            case '<=':
            case '>':
            case '<': {
                // Two types of ==, depneding on the arguments
                if (!Array.isArray(val)) {
                    throw `Property 'and' must have an array`;
                }
                if (val.length !== 2) {
                    throw `for == you must have to provide 2 elements, first one evaluated must == second one`;
                }
                const [first, second] = val;
                if (typeof first === 'object') {
                    if (typeof first['var'] !== 'undefined') {
                        // Case where arguments are (value, const)
                        if (Object.keys(first).length > 1) {
                            throw `For var you must only provide one key 'var'`;
                        }
                        if (typeof second === 'object') {
                            throw `Variables must be compared to strings, numbers or booleans`;
                        }
                        const variable = first['var'];
                        if (variable.startsWith('lumisection')) {
                            // special case
                        }

                        return convert_string_to_table_element({
                            string: variable,
                            value: second,
                            operator: key === '==' ? '=' : key,
                            filter: true
                        });
                    }
                }
            }
            case 'in': {
                if (!Array.isArray(val)) {
                    throw `Property 'in' must have an array`;
                }
                if (val.length !== 2) {
                    throw `for 'in' you must have to provide 2 elements, first one evaluated must 'in' second one`;
                }
                const [first, second] = val;
                if (
                    typeof first !== 'object' ||
                    typeof first['var'] === 'undefined' ||
                    Object.keys(first).length > 1
                ) {
                    throw `First item in array must be object containing 1 single key: "var"`;
                }
                if (typeof second === 'object') {
                    throw `Variables must be compared to strings, numbers or booleans`;
                }
                const variable = first['var'];
                if (variable.startsWith('lumisection')) {
                    throw `Operator 'in' is only useful for run attributes, not for lumiseciton`;
                }
                const like_value = `%${second}%`;
                // we use ilike so its case insensitive
                return convert_string_to_table_element({
                    string: variable,
                    value: like_value,
                    operator: 'ilike',
                    filter: true
                });
            }

            default:
        }
    }
};

const convert_string_to_table_element = ({
    string,
    value,
    operator,
    filter
}) => {
    const elements = string.split('.');
    if (elements.length > 3) {
        throw `You can only filter up to 3 levels`;
    }
    // lumisection.oms.bpix_ready -> 1st level: lumisection, 2nd level: oms, 3rd level: bpix_ready
    const [level1, level2, level3] = elements.map(level => level.toLowerCase());
    let sql = '';

    switch (level1) {
        case 'dataset':
            if (elements.length === 2) {
                if (level2 === 'run_number') {
                    sql = `"Dataset"."run_number"`;
                } else if (level2 === 'name') {
                    sql = `"Dataset"."name"`;
                } else {
                    throw `Dataset can only be filtered in 2 levels by run_number or name, not ${level2}`;
                }
            } else {
                // must be for dataset attributes
                if (level2 !== 'dataset_attributes') {
                    throw `For dataset in 3rd level, you must be filtering for dataset attributes, not ${level2}`;
                }

                sql = `"Dataset"."dataset_attributes" ->> '${level3}'`;
            }
            break;
        case 'run':
            if (elements.length !== 3) {
                throw `For Run elements you must be filtering up to 3 levels`;
            }
            if (level2 === 'oms') {
                sql = `"Run"."oms_attributes" ->> '${level3}'`;
            } else if (level2 === 'rr') {
                sql = `"Run"."rr_attributes" ->> '${level3}'`;
            } else {
                throw `Second level for Runs must be either oms or rr, not ${level2}`;
            }
            break;
        case 'lumisection':
            if (elements.length !== 3) {
                throw `For Lumisection elements you must be filtering up to 3 levels`;
            }
            if (level2 === 'oms') {
                if (filter) {
                    sql = `CAST(
                                ("DatasetTripletCache"."dcs_summary". #>> '{${level3}, ${value.toUpperCase()}}') 
                                AS DOUBLE PRECISION) > 0`;
                    // Add filter > 0 ?
                } else {
                    sql = `"DatasetTripletCache"."dcs_ranges" #>> '{${level3}, ${value.toUpperCase()}}') 
                                 AS ${level3} > 0`;
                }
            } else if (level2 === 'rr') {
                if (filter) {
                    sql = `CAST(
                                ("DatasetTripletCache"."triplet_summary". #>> '{${level3}, ${value.toUpperCase()}}') 
                                AS DOUBLE PRECISION) > 0`;
                    // Add filter > 0 ?
                } else {
                    sql = `"DatasetTripletCache"."rr_ranges" #>> '{${level3}, ${value.toUpperCase()}}') 
                                 AS ${level3} > 0`;
                }
            } else {
                throw `Second level for Runs must be either oms or rr, not ${level2}`;
            }
            break;
    }

    if (level1 !== 'lumisection') {
        if (!isNaN(value)) {
            // If value is a number:
            sql = `(${sql})::float`;
        } else if (typeof value === 'string') {
            value = `'${value}'`;
        }
        sql = `${sql} ${operator} ${value}`;
    }
    return sql;
};

module.exports(`

{
    "and": [
        {
            "or": [
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018A/DQM"]},
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018B/DQM"]},
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018C/DQM"]},
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018D/DQM"]},
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018E/DQM"]},
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018F/DQM"]},
                {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018G/DQM"]}
            ]
        },
        { ">=": [{ "var": "run.oms.energy" }, 6000] },
        { "<=": [{ "var": "run.oms.energy" }, 7000] },
        { ">=": [{ "var": "run.oms.b_field" }, 3.7] },
        { "in": [{ "var": "run.oms.injection_scheme" }, "25ns"] },
        { "==": [{ "in": [{ "var": "run.oms.hlt_key" }, "WMass"] }, false] },

        { "==": [{ "var": "lumisection.rr.dt-dt" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.csc-csc" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.l1t-l1tmu" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.hlt-hlt" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.tracker-pixel" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.tracker-strip" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.tracker-tracking" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.ecal-ecal" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.ecal-es" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.hcal-hcal" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.muon-muon" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.jetmet-jetmet" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.lumi-lumi" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.dc-lowlumi" }, "GOOD"] },

        { "==": [{ "var": "lumisection.oms.cms_active" }, true] },
        { "==": [{ "var": "lumisection.oms.bpix_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.fpix_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.tibtid_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.tecm_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.tecp_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.castor_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.tob_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.ebm_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.ebp_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.eem_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.eep_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.esm_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.esp_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.hbhea_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.hbheb_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.hbhec_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.hf_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.ho_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.dtm_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.dtp_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.dt0_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.cscm_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.cscp_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.rpc_ready" }, true] },
        { "==": [{ "var": "lumisection.oms.beam1_present" }, true] },
        { "==": [{ "var": "lumisection.oms.beam2_present" }, true] },
        { "==": [{ "var": "lumisection.oms.beam1_stable" }, true] },
        { "==": [{ "var": "lumisection.oms.beam2_stable" }, true] }
    ]
}


`);
