package de.fhg.iais.roberta.visitor;

import java.util.List;
import org.json.JSONObject;
import de.fhg.iais.roberta.bean.NNBean;
import de.fhg.iais.roberta.bean.UsedHardwareBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.Phrase;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorMotorAction;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorStopMotorAction;
import de.fhg.iais.roberta.syntax.lang.expr.ColorConst;
import de.fhg.iais.roberta.syntax.lang.expr.NumConst;
import de.fhg.iais.roberta.syntax.sensor.apitor.ApitorColorSensor;
import de.fhg.iais.roberta.syntax.sensor.apitor.ApitorInfraredSensor;
import de.fhg.iais.roberta.syntax.sensor.apitor.ApitorSensorValue;
import de.fhg.iais.roberta.util.basic.C;

public final class ApitorStackMachineVisitor extends RCJStackMachineVisitor {
    public ApitorStackMachineVisitor(ConfigurationAst configuration, List<List<Phrase>> phrases, UsedHardwareBean usedHardwareBean, NNBean nnBean) {
        super(configuration, phrases, usedHardwareBean, nnBean);
    }

    public Void visitApitorMotorAction(ApitorMotorAction action) {
        int level;
        try {
            level = Integer.parseInt(action.speed);
        } catch (NumberFormatException ignored) {
            level = 6;
        }
        level = Math.max(1, Math.min(12, level));
        if ("BACKWARD".equalsIgnoreCase(action.direction)) {
            level = -level;
        }
        new NumConst(null, String.valueOf(level)).accept(this);
        JSONObject node = makeNode(C.MOTOR_ON_ACTION)
            .put(C.PORT, action.port.toUpperCase())
            .put(C.NAME, "apitor")
            .put(C.SPEED_ONLY, true);
        return add(node);
    }

    public Void visitApitorStopMotorAction(ApitorStopMotorAction action) {
        return add(makeNode(C.MOTOR_STOP).put(C.PORT, action.port.toUpperCase()).put(C.NAME, "apitor"));
    }

    public Void visitApitorSensorValue(ApitorSensorValue sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "apitor").put(C.MODE, sensor.mode));
    }

    public Void visitApitorColorSensor(ApitorColorSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "apitor").put(C.MODE, "colorRaw"));
    }

    public Void visitApitorInfraredSensor(ApitorInfraredSensor sensor) {
        String mode;
        switch ( sensor.mode.toUpperCase() ) {
            case "S1_CLEAR":
            case "S1_OUTSIDE":
                mode = "infrared1Outside";
                break;
            case "S2_DETECTED":
            case "S2_LINE":
                mode = "infrared2Line";
                break;
            case "S2_CLEAR":
            case "S2_OUTSIDE":
                mode = "infrared2Outside";
                break;
            case "S1_DETECTED":
            case "S1_LINE":
            default:
                mode = "infrared1Line";
                break;
        }
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "apitor").put(C.MODE, mode));
    }

    /**
     * Translate the four colours supported by Robot X directly to the raw values
     * reported by the official Apitor Kit app: red=1, green=2, blue=3, white=4.
     */
    @Override
    public Void visitColorConst(ColorConst colorConst) {
        int apitorColor;
        switch ( colorConst.getHexValueAsString().toUpperCase() ) {
            case "#CC0000":
            case "#FF0000":
                apitorColor = 1;
                break;
            case "#33CC00":
            case "#008000":
            case "#00FF00":
                apitorColor = 2;
                break;
            case "#3366FF":
            case "#0057A6":
            case "#0000FF":
                apitorColor = 3;
                break;
            case "#FFFFFE":
            case "#FFFFFF":
                apitorColor = 4;
                break;
            default:
                // The generic Blockly colour picker can occur in imported or
                // older programs with values that Robot X cannot recognise.
                // Compile those values to an impossible sentinel instead of
                // turning a valid program into a server error. This also keeps
                // an unsupported colour from matching the sensor's real
                // "unknown" value (0).
                apitorColor = -1;
                break;
        }
        return new NumConst(null, String.valueOf(apitorColor)).accept(this);
    }
}
