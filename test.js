import test from 'ava';
import json_logic_to_sequelize_querying from '.';

const json_test1 = {
    and: [
        { '==': [{ var: 'run.oms.csc_included' }, true] },
        { '==': [{ var: 'lumisection.oms.cscm_ready' }, false] },
        { '==': [{ var: 'lumisection.oms.cscp_ready' }, false] }
    ]
};

const desired_outcome1 = {
    and: []
};
const filter = {
    where: {
        'oms_attributes.csc_included': true
    },
    include: [
        {
            model: 'DatasetTripletCache',
            where: {
                'oms.cscm_ready.true': {
                    '>': 0
                },
                'oms.cscp_ready.true': {
                    '>': 0
                }
            }
        }
    ]
};

test('json-logic-to-sequelize-querying working properly', t => {});

test('json-logic-to-sequelize-querying doing X', t => {});

const big_filter = {
    where: {
        and: [
            {
                or: [
                    { name: '/PromptReco/Collisions18A/DQM' },
                    { name: '/PromptReco/Collisions18B/DQM' },
                    { name: '/PromptReco/Collisions18C/DQM' },
                    { name: '/PromptReco/Collisions18D/DQM' },
                    { name: '/PromptReco/Collisions18E/DQM' },
                    { name: '/PromptReco/Collisions18F/DQM' }
                ]
            },
            { 'oms_attributes.energy': { '>=': 6000 } },
            { 'oms_attributes.energy': { '<=': 7000 } },
            { 'oms_attributes.b_field': { '>=': 3.7 } }
        ]
    },
    include: [
        {
            model: 'DatasetTripletCache',
            where: {
                'triplet_summary.dt-dt.GOOD': { '>': 0 },
                'triplet_summary.csc-csc.GOOD': { '>': 0 },
                'triplet_summary.l1t-l1tmu.GOOD': { '>': 0 },
                'triplet_summary.hlt-hlt.GOOD': { '>': 0 },
                'triplet_summary.tracker-pixel.GOOD': { '>': 0 },
                'triplet_summary.tracker-strip.GOOD': { '>': 0 },
                'triplet_summary.tracker-tracking.GOOD': { '>': 0 },
                'triplet_summary.ecal-ecal.GOOD': { '>': 0 },
                'triplet_summary.ecal-es.GOOD': { '>': 0 },
                'triplet_summary.hcal-hcal.GOOD': { '>': 0 },
                'triplet_summary.muon-muon.GOOD': { '>': 0 },
                'triplet_summary.jetmet-jetmet.GOOD': { '>': 0 },
                'triplet_summary.lumi-lumi.GOOD': { '>': 0 },
                'triplet_summary.dc-lowlumi.GOOD': { '>': 0 }
            }
        }
    ]
};
