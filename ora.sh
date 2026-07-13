#!/bin/bash

function _mkAndCheckDir {
  mkdir -p "$1"
  if [ $? -ne 0 ]
  then
    echo "creating the directory \"$1\" failed - exit 12"
    exit 12
  fi
}

function _export {
  exportpath="$1"
  case "$2" in
    '')     gzip='n' ;;
    'gzip') gzip='y' ;;
    *)      echo "expected 'gzip' as 2nd param or nothing. Got: $2. Exit 12"
            exit 12 ;;
  esac
  if [ -e "$exportpath" ] && [ ! -z "$(ls -A $exportpath)" ]
  then
    echo "target directory \"$exportpath\" exists and is not empty - exit 12"
    exit 12
  fi
  
  echo "creating the target directory \"$exportpath\""
  _mkAndCheckDir "$exportpath"
  exportpath=$(cd "$exportpath"; pwd)
  serverVersion=$(java -cp OpenRobertaServer/target/resources/\* de.fhg.iais.roberta.main.Administration version)
  echo "server version: ${serverVersion}"
  
  echo "copying all jars"
  _mkAndCheckDir "${exportpath}/lib"
  cp OpenRobertaServer/target/resources/*.jar "$exportpath/lib"

  echo 'copying the staticResources'
  cp -r OpenRobertaServer/staticResources ${exportpath}/staticResources
  case "$gzip" in
    'n') echo 'staticResources are NOT gzip-ped. This increases load times when the internet connection is slow. Use for debug only.' ;;
    'y') numberGzFiles=$(find ${exportpath}/staticResources -type f | egrep '\.gz$' | wc -l)
         if [[ $numberGzFiles != 0 ]]
         then
           echo "\n$numberGzFiles gz-files found. This should NOT happen. Please CHECK staticResources in the Git repository\n"
         fi
         find ${exportpath}/staticResources -type f \
         | grep -Ev '\.(png|gif|mp3|gz|jpg|jpeg|wav|ogg)$' \
         | tr '\12' '\0' | tr '\a' '\0' \
         | xargs -n1 -0 gzip -9 -k -v -f
         ;;
  esac
  
  echo 'script for starting the server is copied (.sh and .bat)'
  cp admin.sh admin-help.txt admin.bat ${exportpath}
  chmod ugo+rx admin.sh admin.bat
}

function _stopRcxBridge {
  if [[ -n "$RCX_BRIDGE_PID" ]] && kill -0 "$RCX_BRIDGE_PID" 2>/dev/null
  then
    echo "stopping RCX bridge (pid $RCX_BRIDGE_PID)"
    kill "$RCX_BRIDGE_PID"
    wait "$RCX_BRIDGE_PID" 2>/dev/null
  fi
}

function _syncRcxPlugin {
  local sourceJar
  local targetJar
  sourceJar=$(find RobotRCX/target -maxdepth 1 -type f -name 'RobotRCX-*.jar' ! -name '*-sources.jar' ! -name '*-javadoc.jar' | head -n 1)
  if [[ -z "$sourceJar" ]]
  then
    return 0
  fi

  # Maven can leave both a versioned and an unversioned plugin JAR in the
  # server classpath. Keep every existing copy identical so Java cannot load
  # an older RCX implementation depending on classpath order.
  for targetJar in "$JAVA_LIB_DIR"/RobotRCX*.jar
  do
    if [[ -e "$targetJar" ]] && ! cmp -s "$sourceJar" "$targetJar"
    then
      cp "$sourceJar" "$targetJar"
      echo "updated RCX plugin: $targetJar"
    fi
  done
}

function _startRcxBridge {
  if curl --silent --fail --max-time 1 http://127.0.0.1:2222/status >/dev/null 2>&1
  then
    echo 'RCX bridge already running on http://127.0.0.1:2222'
    return 0
  fi

  if [[ -n "$NQC_PATH" && -x "$NQC_PATH" ]]
  then
    NQC_BINARY="$NQC_PATH"
  else
    case "$(uname -s)" in
      Darwin) NQC_BINARY="$CC_RESOURCE_DIR/RobotRCX/osx/nqc" ;;
      Linux)  NQC_BINARY="$(command -v nqc 2>/dev/null)" ;;
      *)      echo 'RCX bridge autostart is supported by ora.sh on macOS and Linux only'
              return 0 ;;
    esac
  fi

  if [[ -z "$NQC_BINARY" || ! -x "$NQC_BINARY" ]]
  then
    echo "WARNING: RCX bridge not started: nqc not found at '$NQC_BINARY'"
    echo 'See RobotRCX/README.md for the one-time NQC installation.'
    return 0
  fi
  if ! command -v python3 >/dev/null 2>&1
  then
    echo 'WARNING: RCX bridge not started: python3 not found'
    return 0
  fi

  mkdir -p "$ADMIN_DIR/logs"
  RCX_BRIDGE_LOG="$ADMIN_DIR/logs/rcx-bridge.log"
  NQC_PATH="$NQC_BINARY" python3 -u RobotRCX/rcx-bridge.py >"$RCX_BRIDGE_LOG" 2>&1 &
  RCX_BRIDGE_PID=$!
  sleep 1
  if ! kill -0 "$RCX_BRIDGE_PID" 2>/dev/null
  then
    echo "WARNING: RCX bridge failed to start; see $RCX_BRIDGE_LOG"
    RCX_BRIDGE_PID=''
    return 0
  fi
  echo "RCX bridge started on http://127.0.0.1:2222 (pid $RCX_BRIDGE_PID, log $RCX_BRIDGE_LOG)"
  trap _stopRcxBridge EXIT
}

# ---------------------------------------- begin of the script ----------------------------------------------------
if [ ! -d OpenRobertaServer ]
then
  echo 'please start this script from the root of the Git working tree - exit 12'
  exit 12
fi

# the following settings fit for 'export' and 'start-from-git' 
DB_PARENTDIR=./OpenRobertaServer/db-embedded
DB_NAME=openroberta-db
JAVA_LIB_DIR='OpenRobertaServer/target/resources' # created by mvn install ...
ADMIN_DIR='./admin'
CC_RESOURCE_DIR='../ora-cc-rsc'
QUIET='no'
XMX=''
RDBG=''
RCX_BRIDGE_PID=''
 
while true
do
  case "$1" in
    -dbParentdir)  DB_PARENTDIR=$2
                   shift; shift ;;
    -dbName)       DB_NAME=$2
                   shift; shift ;;
    -java-lib-dir) JAVA_LIB_DIR=$2
                   shift; shift ;;
    -admin-dir)    ADMIN_DIR=$2
                   shift; shift ;;
    -oraccrsc)     CC_RESOURCE_DIR=$2
                   shift; shift ;;
    -Xmx*)         XMX=$1
                   shift ;;
    -rdbg)         RDBG='-agentlib:jdwp=transport=dt_socket,server=y,address=0.0.0.0:2000,suspend=y'
                   shift ;;
    -q)            QUIET='yes'
                   shift ;;
    *)             break ;;
  esac
done

DB_URI="jdbc:hsqldb:hsql://localhost/$DB_NAME"
ADMIN_CLASS='de.fhg.iais.roberta.main.Administration'

cmd="$1"
shift

case "$cmd" in
''|help|-h|-help|--help) cat ora-help.txt ;;

export)         _export $* ;;

start-from-git) if [[ ! -d $DB_PARENTDIR ]]; then 
                   echo "No database found. An empty database will be created."
                   java -cp ${JAVA_LIB_DIR}/\* de.fhg.iais.roberta.main.Administration create-empty-db jdbc:hsqldb:file:$DB_PARENTDIR/$DB_NAME
                fi
                _syncRcxPlugin
                _startRcxBridge
                java $RDBG -cp OpenRobertaServer/src/main/resources:${JAVA_LIB_DIR}/\* de.fhg.iais.roberta.main.ServerStarter \
                     -d database.mode=embedded \
                     -d database.parentdir=$DB_PARENTDIR \
                     -d database.name=$DB_NAME \
                     -d server.staticresources.dir=OpenRobertaServer/staticResources \
                     -d robot.crosscompiler.resourcebase="$CC_RESOURCE_DIR" \
                     $* ;;

check-xss)      # unused
                exit 12
                databaseurl="jdbc:hsqldb:file:$DB_PARENTDIR/$DB_NAME"
                java -cp ${JAVA_LIB_DIR}/\* "$ADMIN_CLASS" check-xss "$databaseurl" ;;
                  
renameRobot)    # unused
                exit 12
                databaseurl="jdbc:hsqldb:file:$DB_PARENTDIR/$DB_NAME"
                java -cp ${JAVA_LIB_DIR}/\* "$ADMIN_CLASS" rename "$databaseurl" $2 $3;;
                  
configurationCleanUp) #unused
                exit 12
                databaseurl="jdbc:hsqldb:file:$DB_PARENTDIR/$DB_NAME"
                java -cp ${JAVA_LIB_DIR}/\* "$ADMIN_CLASS" configuration-clean-up "$databaseurl" ;;

*)              echo "invalid command: $cmd - exit 1"
                exit 1 ;;
esac

exit 0
