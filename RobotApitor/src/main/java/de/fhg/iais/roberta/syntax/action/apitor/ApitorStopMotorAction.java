package de.fhg.iais.roberta.syntax.action.apitor;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "APITOR_STOP_MOTOR_ACTION", category = "ACTOR", blocklyNames = {"apitorActions_stopMotor"})
public final class ApitorStopMotorAction extends Action {
    @NepoField(name = "PORT") public final String port;

    public ApitorStopMotorAction(BlocklyProperties properties, String port) {
        super(properties);
        this.port = port;
        setReadOnly();
    }
}
