package de.fhg.iais.roberta.visitor.codegen;

import java.util.Arrays;
import java.util.Iterator;

import com.google.common.collect.ClassToInstanceMap;

import de.fhg.iais.roberta.bean.CodeGeneratorSetupBean;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.bean.UsedHardwareBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.components.UsedSensor;
import de.fhg.iais.roberta.mode.action.DriveDirection;
import de.fhg.iais.roberta.mode.action.MotorStopMode;
import de.fhg.iais.roberta.mode.action.TurnDirection;
import de.fhg.iais.roberta.syntax.Phrase;
import de.fhg.iais.roberta.syntax.action.display.ClearDisplayAction;
import de.fhg.iais.roberta.syntax.actors.edison.ReceiveIRAction;
import de.fhg.iais.roberta.syntax.actors.edison.SendIRAction;
import de.fhg.iais.roberta.syntax.action.display.ShowTextAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorOnAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorSetPowerAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorStopAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.DriveAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.MotorDriveStopAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.TurnAction;
import de.fhg.iais.roberta.syntax.action.sound.PlayNoteAction;
import de.fhg.iais.roberta.syntax.action.sound.ToneAction;
import de.fhg.iais.roberta.syntax.configuration.ConfigurationComponent;
import de.fhg.iais.roberta.syntax.lang.blocksequence.MainTask;
import de.fhg.iais.roberta.syntax.lang.expr.Binary;
import de.fhg.iais.roberta.syntax.lang.expr.Binary.Op;
import de.fhg.iais.roberta.syntax.lang.expr.VarDeclaration;
import de.fhg.iais.roberta.syntax.lang.functions.MathConstrainFunct;
import de.fhg.iais.roberta.syntax.lang.functions.MathModuloFunct;
import de.fhg.iais.roberta.syntax.lang.functions.MathNumPropFunct;
import de.fhg.iais.roberta.syntax.lang.functions.MathPowerFunct;
import de.fhg.iais.roberta.syntax.lang.functions.MathRandomIntFunct;
import de.fhg.iais.roberta.syntax.lang.functions.TextJoinFunct;
import de.fhg.iais.roberta.syntax.lang.stmt.AssertStmt;
import de.fhg.iais.roberta.syntax.lang.stmt.DebugAction;
import de.fhg.iais.roberta.syntax.lang.stmt.RepeatStmt;
import de.fhg.iais.roberta.syntax.lang.stmt.WaitStmt;
import de.fhg.iais.roberta.syntax.lang.stmt.WaitTimeStmt;
import de.fhg.iais.roberta.syntax.sensor.generic.EncoderReset;
import de.fhg.iais.roberta.syntax.sensor.generic.EncoderSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.LightSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TimerReset;
import de.fhg.iais.roberta.syntax.sensor.generic.TimerSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TouchSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.VoltageSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TemperatureSensor;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.dbc.DbcException;
import de.fhg.iais.roberta.util.syntax.FunctionNames;
import de.fhg.iais.roberta.util.syntax.SC;
import de.fhg.iais.roberta.visitor.IRcxVisitor;
import de.fhg.iais.roberta.visitor.IVisitor;
import de.fhg.iais.roberta.visitor.lang.codegen.prog.AbstractCppVisitor;

import java.util.List;

/**
 * NEPO -> NQC Codegenerator fuer den LEGO Mindstorms RCX.
 *
 * VORLAGE: RobotNXT/src/main/java/de/fhg/iais/roberta/visitor/codegen/NxtNxcVisitor.java
 *
 * PORT-KONVENTION (verifiziert an der Vorlage): Sensor-Ports werden ueber
 * brickConfiguration.getConfigurationComponent(userPort).internalPortName
 * aufgeloest und liefern bei configuration.type=old-S Namen wie "S1".
 * NQC erwartet SENSOR_1..SENSOR_3 -> Umsetzung via sensorMacro().
 *
 * WICHTIGE RCX/NQC-FAKTEN:
 *  - Wait() und PlayTone()-Dauer arbeiten in 10-ms-Ticks
 *  - Motor-Power: 0..7 (NEPO liefert 0..100 -> Makro NEPO_PWR)
 *  - FastTimer(n) in 10-ms-Ticks, Timer(n) in 100-ms-Ticks
 *  - Rotationssensor: 16 Ticks pro Umdrehung
 *  - Display: SetUserDisplay(wert, nachkommastellen)
 */
public final class RcxNqcVisitor extends AbstractCppVisitor implements IRcxVisitor<Void> {

    private final ConfigurationAst brickConfiguration;

    public RcxNqcVisitor(List<List<Phrase>> programPhrases, ConfigurationAst brickConfiguration, ClassToInstanceMap<IProjectBean> beans) {
        super(programPhrases, beans);
        this.brickConfiguration = brickConfiguration;
    }

    private boolean isActorOnPort(String port) {
        if ( port == null ) {
            return false;
        }
        return this.brickConfiguration.getActors().stream().anyMatch(a -> a.userDefinedPortName.equals(port));
    }

    private boolean isMotorReversed(ConfigurationComponent motor) {
        return "ON".equals(motor.getOptProperty(SC.MOTOR_REVERSE));
    }

    static String motorOnCommand(boolean motorReversed, boolean logicalForward) {
        boolean electricalForward = logicalForward != motorReversed;
        return electricalForward ? "OnFwd" : "OnRev";
    }

    private String motorOnCommand(ConfigurationComponent motor, boolean logicalForward) {
        return motorOnCommand(isMotorReversed(motor), logicalForward);
    }

    /** "S1" / "1" -> "SENSOR_1" (NQC-Makro). */
    private String sensorMacro(String internalOrUserPort) {
        String digits = internalOrUserPort.replaceAll("\\D", "");
        return "SENSOR_" + digits;
    }

    private String sensorMacroForUserPort(String userPort) {
        return sensorMacro(this.brickConfiguration.getConfigurationComponent(userPort).internalPortName);
    }

    private Void generateUsedVars() {
        for ( VarDeclaration var : this.getBean(UsedHardwareBean.class).getVisitedVars() ) {
            nlIndent();
            if ( !var.value.getKind().hasName("EMPTY_EXPR") ) {
                this.src.add("___", var.name, " = ");
                var.value.accept(this);
                this.src.add(";");
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Programmrahmen
    // ------------------------------------------------------------------

    @Override
    protected void generateProgramPrefix(boolean withWrapping) {
        if ( !withWrapping ) {
            return;
        }
        this.src.add("// generated by Open Roberta Lab (RCX plugin), target: nqc -Trcx2");
        nlIndent();
        this.src.add("#define MIN(X, Y) (((X) < (Y)) ? (X) : (Y))");
        nlIndent();
        this.src.add("#define MAX(X, Y) (((X) > (Y)) ? (X) : (Y))");
        nlIndent();
        // NEPO-Power (0..100) -> RCX-Power (0..7)
        this.src.add("#define NEPO_PWR(P) (MIN(MAX((P), 0), 100) * 7 / 100)");
        nlIndent();
        nlIndent();
        generateSignaturesOfUserDefinedMethods();
        if ( !this.getBean(CodeGeneratorSetupBean.class).getUsedMethods().isEmpty() ) {
            nlIndent();
            String helperMethodImpls =
                this
                    .getBean(CodeGeneratorSetupBean.class)
                    .getHelperMethodGenerator()
                    .getHelperMethodDeclarations(this.getBean(CodeGeneratorSetupBean.class).getUsedMethods());
            Iterator<String> it = Arrays.stream(helperMethodImpls.split("\n")).iterator();
            while ( it.hasNext() ) {
                this.src.add(it.next());
                if ( it.hasNext() ) {
                    nlIndent();
                }
            }
        }
    }

    @Override
    protected void generateProgramSuffix(boolean withWrapping) {
        decrIndentation();
        if ( withWrapping ) {
            nlIndent();
            this.src.add("}");
            nlIndent();
        }
        generateUserDefinedMethods();
        super.generateProgramSuffix(withWrapping);
    }

    @Override
    public Void visitMainTask(MainTask mainTask) {
        mainTask.variables.accept(this); // nur int-Variablen; Validator sichert das ab
        nlIndent();
        this.src.add("task main() {");
        incrIndentation();
        generateUsedVars();
        generateSensorInit();
        return null;
    }

    /**
     * SetSensor(...)-Zeilen fuer alle genutzten Sensoren erzeugen.
     * ACHTUNG (aus der Vorlage uebernommen): in getUsedSensors() tauchen auch
     * TIMER-Eintraege auf -> ueberspringen! Der Sensortyp kommt aus der
     * Konfigurationskomponente, nicht aus usedSensor.getType().
     */
    private void generateSensorInit() {
        for ( UsedSensor usedSensor : this.getBean(UsedHardwareBean.class).getUsedSensors() ) {
            if ( usedSensor.getType().equals(SC.TIMER) || usedSensor.getType().equals(SC.VOLTAGE) ) {
                // TIMER: kein physischer Sensor. VOLTAGE: interne
                // Batteriespannung (BatteryLevel()), haengt an keinem Port.
                continue;
            }
            ConfigurationComponent cc = this.brickConfiguration.getConfigurationComponent(usedSensor.getPort());
            String macro = sensorMacro(cc.internalPortName);
            nlIndent();
            switch ( cc.componentType ) {
                case SC.TOUCH:
                    this.src.add("SetSensor(", macro, ", SENSOR_TOUCH);");
                    break;
                case SC.LIGHT:
                    this.src.add("SetSensor(", macro, ", SENSOR_LIGHT);");
                    break;
                case SC.ENCODER: // Rotationssensor
                    this.src.add("SetSensor(", macro, ", SENSOR_ROTATION);");
                    break;
                case SC.TEMPERATURE:
                    this.src.add("SetSensor(", macro, ", SENSOR_CELSIUS);");
                    break;
                default:
                    throw new DbcException("Sensor wird vom RCX nicht unterstuetzt: " + cc.componentType);
            }
        }
    }

    // ------------------------------------------------------------------
    // Variablen
    // ------------------------------------------------------------------

    @Override
    public Void visitVarDeclaration(VarDeclaration var) {
        // RCX: alles ist int, keine Arrays
        this.src.add(getLanguageVarTypeFromBlocklyType(var.getBlocklyType()), " ", var.getCodeSafeName());
        return null;
    }

    @Override
    protected String getLanguageVarTypeFromBlocklyType(BlocklyType type) {
        switch ( type ) {
            case ANY:
            case COMPARABLE:
            case ADDABLE:
            case NULL:
            case REF:
            case PRIM:
            case NOTHING:
            case CAPTURED_TYPE:
            case CAPTURED_TYPE_ARRAY_ITEM:
                return "";
            case NUMBER_INT:
            case NUMBER:
            case COLOR:
            case CONNECTION:
                return "int";
            case BOOLEAN:
                return "bool";
            case VOID:
                return "void";
            default:
                throw new DbcException("Typ wird vom RCX nicht unterstuetzt: " + type);
        }
    }

    // ------------------------------------------------------------------
    // Ausdruecke
    // ------------------------------------------------------------------

    @Override
    public Void visitBinary(Binary binary) {
        Op op = binary.op;
        boolean isOpBasicMaths = op == Op.ADD || op == Op.MINUS || op == Op.DIVIDE || op == Op.MULTIPLY;
        if ( isOpBasicMaths ) {
            this.src.add("(");
        }
        generateSubExpr(this.src, false, binary.left, binary);
        String sym = getBinaryOperatorSymbol(op);
        this.src.add(" ", sym, " ");
        // RCX: Integer-Division (kein *1.0 wie beim NXT)
        generateSubExpr(this.src, parenthesesCheck(binary), binary.getRight(), binary);
        if ( isOpBasicMaths ) {
            this.src.add(")");
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Schleifen und Warten
    // ------------------------------------------------------------------

    @Override
    public Void visitRepeatStmt(RepeatStmt repeatStmt) {
        boolean isWaitStmt = repeatStmt.mode == RepeatStmt.Mode.WAIT;
        switch ( repeatStmt.mode ) {
            case UNTIL:
            case WHILE:
            case FOREVER:
                increaseLoopCounter();
                generateCodeFromStmtCondition("while", repeatStmt.expr);
                break;
            case TIMES:
            case FOR:
                increaseLoopCounter();
                generateCodeFromStmtConditionFor("for", repeatStmt.expr);
                break;
            case WAIT:
                generateCodeFromStmtCondition("if", repeatStmt.expr);
                break;
            case FOR_EACH:
                // RCX hat keine Arrays -> sollte vom Validator gesperrt sein
                throw new DbcException("FOR_EACH wird vom RCX nicht unterstuetzt");
            case FOREVER_ARDU:
                throw new DbcException("FOREVER_ARDU is invalid with rcx");
        }
        incrIndentation();
        repeatStmt.list.accept(this);
        if ( !isWaitStmt ) {
            addContinueLabelToLoop();
        } else {
            appendBreakStmt();
        }
        decrIndentation();
        nlIndent();
        this.src.add("}");
        addBreakLabelToLoop(isWaitStmt);
        return null;
    }

    @Override
    public Void visitWaitStmt(WaitStmt waitStmt) {
        this.src.add("while (true) {");
        incrIndentation();
        visitStmtList(waitStmt.statements);
        nlIndent();
        this.src.add("Wait(1);"); // 10ms Tick (NQC Wait arbeitet in 10ms-Ticks)
        decrIndentation();
        nlIndent();
        this.src.add("}");
        return null;
    }

    @Override
    public Void visitWaitTimeStmt(WaitTimeStmt waitTimeStmt) {
        this.src.add("Wait((");
        waitTimeStmt.time.accept(this);
        this.src.add(") / 10);");
        return null;
    }

    // ------------------------------------------------------------------
    // Motoren (einzeln)
    // ------------------------------------------------------------------

    @Override
    public Void visitMotorOnAction(MotorOnAction motorOnAction) {
        String port = motorOnAction.getUserDefinedPort();
        if ( !isActorOnPort(port) ) {
            return null;
        }
        boolean reverse = "ON".equals(this.brickConfiguration.getConfigurationComponent(port).getOptProperty(SC.MOTOR_REVERSE));
        String onCmd = reverse ? "OnRev" : "OnFwd";
        this.src.add("SetPower(OUT_", port, ", NEPO_PWR(");
        motorOnAction.param.getSpeed().accept(this);
        this.src.add("));");
        nlIndent();
        this.src.add(onCmd, "(OUT_", port, ");");
        // "Motor an fuer x Rotationen/Grad": auf dem RCX nur mit Rotationssensor
        // moeglich -> im Validator verbieten oder spaeter Warte-Schleife generieren.
        if ( motorOnAction.param.getDuration() != null ) {
            throw new DbcException("MotorOn mit Dauer/Rotationen: auf dem RCX nur via Rotationssensor (TODO)");
        }
        return null;
    }

    @Override
    public Void visitMotorSetPowerAction(MotorSetPowerAction a) {
        String port = a.getUserDefinedPort();
        if ( isActorOnPort(port) ) {
            this.src.add("SetPower(OUT_", port, ", NEPO_PWR(");
            a.power.accept(this);
            this.src.add("));");
        }
        return null;
    }

    @Override
    public Void visitMotorStopAction(MotorStopAction a) {
        if ( isActorOnPort(a.getUserDefinedPort()) ) {
            String cmd = a.mode == MotorStopMode.FLOAT ? "Float" : "Off";
            this.src.add(cmd, "(OUT_", a.getUserDefinedPort(), ");");
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Differentialantrieb -- Ports/Reverse aus der Konfiguration
    // ------------------------------------------------------------------

    @Override
    public Void visitDriveAction(DriveAction driveAction) {
        ConfigurationComponent left = this.brickConfiguration.getFirstMotor(SC.LEFT);
        ConfigurationComponent right = this.brickConfiguration.getFirstMotor(SC.RIGHT);
        String l = left.userDefinedPortName;
        String r = right.userDefinedPortName;
        // Enum-Vergleich wie in der Vorlage (NICHT toString()!):
        boolean logicalForward = driveAction.direction != DriveDirection.BACKWARD;
        String leftCmd = motorOnCommand(left, logicalForward);
        String rightCmd = motorOnCommand(right, logicalForward);
        this.src.add("SetPower(OUT_", l, "+OUT_", r, ", NEPO_PWR(");
        driveAction.param.getSpeed().accept(this);
        this.src.add("));");
        nlIndent();
        if ( leftCmd.equals(rightCmd) ) {
            this.src.add(leftCmd, "(OUT_", l, "+OUT_", r, ");");
        } else {
            this.src.add(leftCmd, "(OUT_", l, "); ");
            this.src.add(rightCmd, "(OUT_", r, ");");
        }
        if ( driveAction.param.getDuration() != null ) {
            throw new DbcException("Fahren mit Distanzangabe wird vom RCX nicht unterstuetzt");
        }
        return null;
    }

    @Override
    public Void visitTurnAction(TurnAction turnAction) {
        ConfigurationComponent left = this.brickConfiguration.getFirstMotor(SC.LEFT);
        ConfigurationComponent right = this.brickConfiguration.getFirstMotor(SC.RIGHT);
        String l = left.userDefinedPortName;
        String r = right.userDefinedPortName;
        boolean turnLeft = turnAction.direction == TurnDirection.LEFT;
        String leftCmd = motorOnCommand(left, !turnLeft);
        String rightCmd = motorOnCommand(right, turnLeft);
        this.src.add("SetPower(OUT_", l, "+OUT_", r, ", NEPO_PWR(");
        turnAction.param.getSpeed().accept(this);
        this.src.add("));");
        nlIndent();
        this.src.add(leftCmd, "(OUT_", l, "); ");
        this.src.add(rightCmd, "(OUT_", r, ");");
        if ( turnAction.param.getDuration() != null ) {
            throw new DbcException("Drehen um Gradzahl wird vom RCX nicht unterstuetzt");
        }
        return null;
    }

    @Override
    public Void visitMotorDriveStopAction(MotorDriveStopAction stopAction) {
        ConfigurationComponent left = this.brickConfiguration.getFirstMotor(SC.LEFT);
        ConfigurationComponent right = this.brickConfiguration.getFirstMotor(SC.RIGHT);
        this.src.add("Off(OUT_", left.userDefinedPortName, "+OUT_", right.userDefinedPortName, ");");
        return null;
    }

    // ------------------------------------------------------------------
    // Sound & Display & Zeit
    // ------------------------------------------------------------------

    @Override
    public Void visitSendIRAction(SendIRAction sendIRAction) {
        // Die RCX-Firmware akzeptiert Nachrichten von 1 bis 255. Auch
        // berechnete Werte werden begrenzt, nicht nur konstante Blockwerte.
        this.src.add("SendMessage(MIN(MAX(");
        sendIRAction.code.accept(this);
        this.src.add(", 1), 255));");
        return null;
    }

    @Override
    public Void visitReceiveIRAction(ReceiveIRAction receiveIRAction) {
        // Letzte empfangene IR-Nachricht (0 = keine Nachricht im Puffer)
        this.src.add("Message()");
        return null;
    }

    @Override
    public Void visitToneAction(ToneAction toneAction) {
        this.src.add("PlayTone(");
        toneAction.frequency.accept(this);
        this.src.add(", (");
        toneAction.duration.accept(this);
        this.src.add(") / 10);"); // ms -> 10-ms-Ticks
        nlIndent();
        this.src.add("Wait((");
        toneAction.duration.accept(this);
        this.src.add(") / 10);"); // PlayTone blockiert nicht -> warten
        return null;
    }

    @Override
    public Void visitPlayNoteAction(PlayNoteAction playNoteAction) {
        // Frequenz und Dauer sind direkte Zahlenwerte
        this.src.add("PlayTone(", playNoteAction.frequency, ", ", playNoteAction.duration, " / 10);");
        nlIndent();
        this.src.add("Wait(", playNoteAction.duration, " / 10);");
        return null;
    }

    @Override
    public Void visitShowTextAction(ShowTextAction showTextAction) {
        // RCX-LCD kann nur Zahlen. Validator laesst nur numerische Ausdruecke zu.
        this.src.add("SetUserDisplay(");
        showTextAction.msg.accept(this);
        this.src.add(", 0);");
        return null;
    }

    @Override
    public Void visitClearDisplayAction(ClearDisplayAction a) {
        this.src.add("SelectDisplay(DISPLAY_WATCH);");
        return null;
    }

    // ------------------------------------------------------------------
    // Timer
    // ------------------------------------------------------------------

    @Override
    public Void visitTimerSensor(TimerSensor timerSensor) {
        this.src.add("(FastTimer(0) * 10)"); // -> Millisekunden
        return null;
    }

    @Override
    public Void visitVoltageSensor(VoltageSensor voltageSensor) {
        // Batteriespannung in Millivolt; benoetigt RCX-Firmware 2.0 (fast.rcx)
        this.src.add("BatteryLevel()");
        return null;
    }

    @Override
    public Void visitTimerReset(TimerReset timerReset) {
        this.src.add("ClearTimer(0);");
        return null;
    }

    // ------------------------------------------------------------------
    // Sensoren lesen (Portaufloesung via internalPortName, wie Vorlage)
    // ------------------------------------------------------------------

    @Override
    public Void visitTouchSensor(TouchSensor touchSensor) {
        this.src.add(sensorMacroForUserPort(touchSensor.getUserDefinedPort()));
        return null;
    }

    @Override
    public Void visitLightSensor(LightSensor lightSensor) {
        this.src.add(sensorMacroForUserPort(lightSensor.getUserDefinedPort())); // 0..100 (%)
        return null;
    }

    @Override
    public Void visitEncoderSensor(EncoderSensor encoderSensor) {
        // Rotationssensor: 16 Ticks/Umdrehung. NEPO erwartet Grad -> * 360 / 16
        // ACHTUNG: beim NXT haengen Encoder an Motorports -- beim RCX ist es ein
        // eigener Sensor an Port 1..3. Toolbox/Konfiguration entsprechend anlegen!
        this.src.add("(", sensorMacroForUserPort(encoderSensor.getUserDefinedPort()), " * 360 / 16)");
        return null;
    }

    @Override
    public Void visitEncoderReset(EncoderReset encoderReset) {
        this.src.add("ClearSensor(", sensorMacroForUserPort(encoderReset.sensorPort), ");");
        return null;
    }

    @Override
    public Void visitTemperatureSensor(TemperatureSensor temperatureSensor) {
        this.src.add(sensorMacroForUserPort(temperatureSensor.getUserDefinedPort()));
        return null;
    }

    // ------------------------------------------------------------------
    // Mathematische Funktionen (nur int-basiert)
    // ------------------------------------------------------------------

    @Override
    public Void visitMathConstrainFunct(MathConstrainFunct mathConstrainFunct) {
        this.src.add("MIN(MAX(");
        mathConstrainFunct.value.accept(this);
        this.src.add(", ");
        mathConstrainFunct.lowerBound.accept(this);
        this.src.add("), ");
        mathConstrainFunct.upperBound.accept(this);
        this.src.add(")");
        return null;
    }

    @Override
    public Void visitMathNumPropFunct(MathNumPropFunct mathNumPropFunct) {
        switch ( mathNumPropFunct.functName ) {
            case EVEN:
                this.src.add("(");
                mathNumPropFunct.param.get(0).accept(this);
                this.src.add(" % 2 == 0)");
                break;
            case ODD:
                this.src.add("(");
                mathNumPropFunct.param.get(0).accept(this);
                this.src.add(" % 2 != 0)");
                break;
            case PRIME:
                this.src.add(this.getBean(CodeGeneratorSetupBean.class).getHelperMethodGenerator().getHelperMethodName(FunctionNames.PRIME), "(");
                mathNumPropFunct.param.get(0).accept(this);
                this.src.add(")");
                break;
            case WHOLE:
                // RCX hat nur int, also ist jede Zahl "ganz"
                this.src.add("true");
                break;
            case POSITIVE:
                this.src.add("(");
                mathNumPropFunct.param.get(0).accept(this);
                this.src.add(" > 0)");
                break;
            case NEGATIVE:
                this.src.add("(");
                mathNumPropFunct.param.get(0).accept(this);
                this.src.add(" < 0)");
                break;
            case DIVISIBLE_BY:
                this.src.add("(");
                mathNumPropFunct.param.get(0).accept(this);
                this.src.add(" % ");
                mathNumPropFunct.param.get(1).accept(this);
                this.src.add(" == 0)");
                break;
            default:
                break;
        }
        return null;
    }

    @Override
    public Void visitMathRandomIntFunct(MathRandomIntFunct mathRandomIntFunct) {
        this.src.add("Random((");
        mathRandomIntFunct.to.accept(this);
        this.src.add(") - (");
        mathRandomIntFunct.from.accept(this);
        this.src.add(")) + (");
        mathRandomIntFunct.from.accept(this);
        this.src.add(")");
        return null;
    }

    @Override
    public Void visitMathModuloFunct(MathModuloFunct mathModuloFunct) {
        this.src.add("( ( ");
        mathModuloFunct.dividend.accept(this);
        this.src.add(" ) % ( ");
        mathModuloFunct.divisor.accept(this);
        this.src.add(" ) )");
        return null;
    }

    @Override
    public Void visitMathPowerFunct(MathPowerFunct mathPowerFunct) {
        this.src.add(this.getBean(CodeGeneratorSetupBean.class).getHelperMethodGenerator().getHelperMethodName(FunctionNames.POWER), "(");
        mathPowerFunct.param.get(0).accept(this);
        this.src.add(", ");
        mathPowerFunct.param.get(1).accept(this);
        this.src.add(")");
        return null;
    }

    @Override
    public Void visitTextJoinFunct(TextJoinFunct textJoinFunct) {
        return null;
    }

    // ------------------------------------------------------------------
    // Nicht unterstuetzte Blöcke (Validator sperrt, hier trotzdem absichern)
    // ------------------------------------------------------------------

    @Override
    public Void visitAssertStmt(AssertStmt assertStmt) {
        return null;
    }

    @Override
    public Void visitDebugAction(DebugAction debugAction) {
        return null;
    }
}
