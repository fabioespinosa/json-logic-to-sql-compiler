const assert = require('assert').strict;

module.exports = json_input => {
    try {
        const valid_json = JSON.parse(json_input);

        let select = parse_select(valid_json);
        // Remove last trailing comma from select
        select = select.substring(0, select.length - 3);
        const filter = parse_filter(valid_json);
        const sql = `
    SELECT "DatasetTripletCache".run_number, "DatasetTripletCache".name, 

        ${select} 

    FROM "Dataset" inner join "Run" 
    ON "Dataset"."run_number" = "Run"."run_number" 
    INNER JOIN "DatasetTripletCache" 
    ON "Dataset"."run_number" = "DatasetTripletCache"."run_number" 
    AND "Dataset"."name" = "DatasetTripletCache"."name"
    WHERE 

        ${filter}
        `;
        return sql;
    } catch (err) {
        console.log('Unvalid JSON');
        throw err;
    }
};

const parse_filter = json => {
    for (const [key, val] of Object.entries(json)) {
        switch (key) {
            case 'and':
                return parse_and(val);
            case 'or':
                return parse_or(val);
            case 'in':
                return parse_in(val);
            default:
                assert.ok(['==', '>=', '<=', '<', '>'].includes(key));
                return parse_operator(val, key);
        }
    }
};

const parse_and = (array_of_expressions, operator = 'AND') => {
    assert.ok(Array.isArray(array_of_expressions));
    if (array_of_expressions.length === 1) {
        return ` (${parse_filter(array_of_expressions[0])}) `;
    } else {
        let generated_string = '';
        array_of_expressions.forEach((exp, index) => {
            generated_string += `(${parse_filter(exp)})`;
            if (index !== array_of_expressions.length - 1) {
                generated_string += ` ${operator} \n`;
            }
        });
        return generated_string;
    }
};

// The OR is the same as parse_and expect is uses OR operator:
const parse_or = array_of_expressions => parse_and(array_of_expressions, 'OR');

// Parses ==, >=, <=, >, < (as the operator):
const parse_operator = (operation, operator) => {
    assert.ok(Array.isArray(operation));
    assert.ok(operation.length === 2);
    // lhs = left hand side, rhs = right hand side
    const [lhs, rhs] = operation;

    if (typeof lhs === 'object') {
        if (typeof lhs['var'] !== 'undefined') {
            // Case where arguments are (value, const)
            assert.ok(Object.keys(lhs).length === 1);
            assert.ok(typeof rhs !== 'object');
            const variable = lhs['var'];

            return parse_variable({
                string: variable,
                value: rhs,
                operator: operator === '==' ? '=' : operator,
                filter: true
            });
        } else {
            if (typeof rhs !== 'object') {
                // Case where argumetns are (expr, value);
                if (operator === '==') {
                    operator = '=';
                }
                return `(${parse_filter(lhs)}) ${operator} ${rhs}`;
            }
            if (typeof rhs === 'object') {
                // Comparing expression, to expression is only valid for equality comparison (==):
                assert.ok(operator === '==');
                // Case where arguments are (expr, expr)\
                return `(${parse_filter(lhs)}) = (${parse_filter(rhs)})`;
            }
        }
    }
};

const parse_in = array_of_in => {
    assert.ok(Array.isArray(array_of_in));
    assert.ok(array_of_in.length === 2);
    const [lhs, rhs] = array_of_in;
    assert.ok(typeof lhs === 'object');
    assert.ok(typeof lhs['var'] !== 'undefined');
    assert.ok(Object.keys(lhs).length === 1);
    assert.ok(typeof rhs === 'string');
    const variable = lhs['var'];
    // 'in' can only be used for run values, not lumisection:
    assert.ok(!variable.startsWith('lumisection'));

    const like_value = `%${rhs}%`;
    return parse_variable({
        string: variable,
        value: like_value,
        // we use ilike so its case insensitive
        operator: 'ilike',
        filter: true
    });
};

const parse_datasetvalue = ({ level2, level3 }) => {
    if (typeof level3 === 'undefined') {
        // Must be for run_number or name:
        assert.ok(['run_number', 'name'].includes(level2));
        return `"Dataset"."${level2}"`;
    } else {
        // must be for dataset attributes
        assert.ok(level2 === 'dataset_attributes');
        return `"Dataset"."dataset_attributes" ->> '${level3}'`;
    }
};

const parse_runvalue = ({ level2, level3 }) => {
    assert.ok(['oms', 'rr'].includes(level2));
    const oms_rr_conversion_summary = {
        oms: 'oms_attributes',
        rr: 'rr_attributes'
    };
    const column = oms_rr_conversion_summary[level2];
    return `"Run"."${column}" ->> '${level3}'`;
};

const parse_lumisectionvalue = ({ level2, level3, value }) => {
    assert.ok(['rr', 'oms'].includes(level2));
    value = String(value).toUpperCase();
    const oms_rr_conversion_summary = {
        oms: 'dcs_summary',
        rr: 'triplet_summary'
    };

    const column = oms_rr_conversion_summary[level2];
    return `CAST(("DatasetTripletCache"."${column}" #>> '{${level3}, ${value}}') AS DOUBLE PRECISION) > 0`;
};

const parse_variable = ({ string, value, operator }) => {
    const elements = string.split('.');
    if (elements.length > 3) {
        throw `You can only filter up to 3 levels`;
    }
    // lumisection.oms.bpix_ready -> 1st level: lumisection, 2nd level: oms, 3rd level: bpix_ready
    const [level1, level2, level3] = elements.map(level => level.toLowerCase());
    let sql = '';

    switch (level1) {
        case 'dataset':
            sql = parse_datasetvalue({ level2, level3 });
            break;
        case 'run':
            assert.ok(elements.length === 3);
            sql = parse_runvalue({ level2, level3 });
            break;
        case 'lumisection':
            assert.ok(elements.length === 3);
            sql = parse_lumisectionvalue({ level2, level3, value });
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

/// For select

// Select lumisections
const parse_select = json => {
    for (const [key, val] of Object.entries(json)) {
        switch (key) {
            case 'and':
                return parse_and_select(val);
            case 'or':
                return parse_and_select(val);
            case 'in':
                return;
            default:
                assert.ok(['==', '>=', '<=', '<', '>'].includes(key));
                return parse_operator_select(val, key);
        }
    }
};

const parse_and_select = array_of_expressions => {
    if (array_of_expressions.length === 1) {
        return ` (${parse_select(array_of_expressions[0])}) `;
    } else {
        let generated_select = '';
        array_of_expressions.forEach((exp, index) => {
            const current_select = parse_select(exp);
            if (current_select) {
                generated_select += current_select;
            }
        });
        return generated_select;
    }
};

const parse_operator_select = (operation, operator) => {
    const [lhs, rhs] = operation;

    if (typeof lhs === 'object') {
        if (typeof lhs['var'] !== 'undefined') {
            // Case where arguments are (value, const)
            const variable = lhs['var'];
            if (variable.startsWith('lumisection')) {
                const elements = variable.split('.');
                const [level1, level2, level3] = elements.map(level =>
                    level.toLowerCase()
                );
                return parse_lumisectionvalue_select({
                    level2,
                    level3,
                    value: rhs
                });
            }
        } else {
            if (typeof rhs !== 'object') {
                // Case where argumetns are (expr, value);
                if (operator === '==') {
                    operator = '=';
                }
                return parse_select(lhs);
            }
            if (typeof rhs === 'object') {
                // Comparing expression, to expression is only valid for equality comparison (==):
                assert.ok(operator === '==');
                // Case where arguments are (expr, expr)\
                return `${parse_select(lhs)} ${parse_select(rhs)}`;
            }
        }
    }
};
const parse_lumisectionvalue_select = ({ level2, level3, value }) => {
    assert.ok(['rr', 'oms'].includes(level2));
    value = String(value).toUpperCase();
    const oms_rr_conversion_ranges = {
        oms: 'dcs_ranges',
        rr: 'rr_ranges'
    };

    const column_select = oms_rr_conversion_ranges[level2];
    return `"DatasetTripletCache"."${column_select}" #>> '{${level3}, ${value}}' AS "${level3}" ,\n`;
};

console.log(
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
        { "==": [{ "var": "lumisection.rr.tracker-track" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.ecal-ecal" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.ecal-es" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.hcal-hcal" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.muon-muon" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.jetmet-jetmet" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.lumi-lumi" }, "GOOD"] },
        { "==": [{ "var": "lumisection.rr.dc-lowlumi" }, "BAD"] },

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


`)
);
