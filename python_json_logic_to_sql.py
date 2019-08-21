import json

logic = """

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
"""

logicobj = json.loads(logic)


def sqlsafe(arg):
    # TODO
    return str(arg)


def indent(string):
    return "  " + "\n  ".join(string.split("\n"))


class Expr():
    pass


class ConstExpr(Expr):
    def __str__(self):
        return sqlsafe(self.val)


class AndExpr(Expr):
    def __str__(self):
        return "(\n" + indent(" AND \n".join([str(e) for e in self.subexp])) + "\n)"


class OrExpr(Expr):
    def __str__(self):
        return "(\n" + indent(" OR \n".join([str(e) for e in self.subexp])) + "\n)"


class EqExprExpr(Expr):
    def __str__(self):
        return "(" + str(self.lhs) + " = " + str(self.rhs) + ")"


class EqLumiValueExpr(Expr):
    def __str__(self):
        return "(" + str(self.lhs) + "." + str(self.rhs) + " > 0 )"


class EqRunValueExpr(Expr):
    def __str__(self):
        return "(" + str(self.lhs) + " = " + str(self.rhs) + ")"


class RelLumiValueExpr(Expr):
    pass


class RelRunValueExpr(Expr):
    def __str__(self):
        return "(" + str(self.lhs) + " " + self.op + " " + str(self.rhs) + ")"


class InRunValueExpr(Expr):
    pass


class ConstValue():
    def __str__(self):
        return '"' + sqlsafe(self.val) + '"'


class RunValue():
    def __str__(self):
        return sqlsafe(self.name)


class LumiValue():
    def __str__(self):
        return sqlsafe(self.name)


def parse_const(obj):
    assert(isinstance(obj, str) or isinstance(
        obj, int) or isinstance(obj, float))
    val = ConstValue()
    val.val = obj
    return val


def parse_runvalue(obj):
    items = list(obj.items())
    assert(len(items) == 1)
    assert(items[0][0] == "var")
    name = items[0][1]
    assert(isinstance(name, str))
    assert(name.split(".")[0] in ["dataset", "run"])
    val = RunValue()
    val.name = name
    return val


def parse_lumivalue(obj):
    items = list(obj.items())
    assert(len(items) == 1)
    assert(items[0][0] == "var")
    name = items[0][1]
    assert(isinstance(name, str))
    assert(name.split(".")[0] == "lumisection")
    val = LumiValue()
    val.name = name
    return val


def parse_eq(op, args):
    assert(len(args) == 2)
    options = [
        (EqExprExpr, lambda lhs, rhs: (parse_expr(lhs), parse_expr(rhs))),
        (EqLumiValueExpr, lambda lhs, rhs: (parse_lumivalue(lhs), parse_const(rhs))),
        (EqRunValueExpr, lambda lhs, rhs: (parse_runvalue(lhs), parse_const(rhs))),
    ]
    for exprclass, argparse in options:
        exp = exprclass()
        try:
            exp.lhs, exp.rhs = argparse(args[0], args[1])
        except:
            continue
        return exp
    # out of options
    print(args)
    assert(False)


def parse_rel(op, args):
    assert(len(args) == 2)
    options = [
        (RelLumiValueExpr, lambda lhs, rhs: (
            parse_lumivalue(lhs), parse_const(rhs))),
        (RelRunValueExpr, lambda lhs, rhs: (parse_runvalue(lhs), parse_const(rhs))),
    ]
    for exprclass, argparse in options:
        exp = exprclass()
        try:
            exp.lhs, exp.rhs = argparse(args[0], args[1])
        except:
            continue
        exp.op = op
        return exp
    # out of options
    print(args)
    assert(False)


def parse_in(op, args):
    assert(len(args) == 2)
    exp = InRunValueExpr()
    exp.lhs = parse_runvalue(args[0])
    exp.rhs = parse_const(args[1])
    return exp


def parse_and(op, args):
    exp = AndExpr()
    exp.subexp = [parse_expr(obj) for obj in args]
    return exp


def parse_or(op, args):
    exp = OrExpr()
    exp.subexp = [parse_expr(obj) for obj in args]
    return exp


def parse_expr(obj):
    # If its a boolean:
    if isinstance(obj, bool):
        exp = ConstExpr()
        exp.val = obj
        return exp
    else:
        # It must be an expression:
        items = list(obj.items())
        assert(len(items) == 1)
        op = items[0][0]
        args = items[0][1]
        decode = {
            "and": parse_and,
            "or": parse_or,
            "==": parse_eq,
            "<": parse_rel,
            ">": parse_rel,
            ">=": parse_rel,
            "<=": parse_rel,
            "in": parse_in,
        }
        return decode[op](op, args)


print(parse_expr(logicobj))
