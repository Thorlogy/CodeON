package de.fhg.iais.roberta.syntax.action.cozmo;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.syntax.lang.expr.Expr;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.transformer.forField.NepoValue;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "COZMO_SET_ACTUATOR_ACTION", category = "ACTOR", blocklyNames = {"cozmoActions_setActuator"})
public final class CozmoSetActuatorAction extends Action {
    @NepoField(name = "ACTUATOR")
    public final String actuator;
    @NepoValue(name = "VALUE", type = BlocklyType.NUMBER)
    public final Expr value;

    public CozmoSetActuatorAction(BlocklyProperties properties, String actuator, Expr value) {
        super(properties);
        this.actuator = actuator;
        this.value = value;
        setReadOnly();
    }
}
