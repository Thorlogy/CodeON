package de.fhg.iais.roberta.syntax.action.apitor;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "APITOR_MOTOR_ACTION", category = "ACTOR", blocklyNames = {"apitorActions_motor"})
public final class ApitorMotorAction extends Action {
    @NepoField(name = "PORT") public final String port;
    @NepoField(name = "DIRECTION") public final String direction;
    @NepoField(name = "SPEED") public final String speed;

    public ApitorMotorAction(BlocklyProperties properties, String port, String direction, String speed) {
        super(properties);
        this.port = port;
        this.direction = direction;
        this.speed = speed;
        setReadOnly();
    }
}
