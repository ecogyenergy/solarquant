# When exporting data using the stream functionality, we should not include
# rows which have incomplete data. This can happen when we request a measurement
# which does not exist anywhere on the requested sourceId(s)
@test "stream skip incomplete rows" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,timestamp,voltage
EOF
)
  OUT=$(node ../src/ datums stream pyr1 timestamp,voltage 2022-12-01 2023-01-01 -a Day)
  [ "$OUT" = "$EXPECTED" ]
}

# We can include incomplete rows with --partial
@test "include partial rows" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,timestamp,irradiance,voltage
pyr1,1,1669870800000,111.85453965263889,
pyr1,1,1669957200000,126.43718182368056,
pyr1,1,1670043600000,14.893976233333333,
pyr1,1,1670130000000,102.06783405555555,
EOF
)
  OUT=$(node ../src/ datums stream pyr1 timestamp,irradiance,voltage 2022-12-01 2023-01-01 -a Day --partial)
  [ "$OUT" = "$EXPECTED" ]
}

# Or include all rows, even if we're missing all relevant columns
@test "include empty rows" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,timestamp,voltage
pyr1,1,1669870800000,
pyr1,1,1669957200000,
pyr1,1,1670043600000,
pyr1,1,1670130000000,
EOF
)
  OUT=$(node ../src/ datums stream pyr1 timestamp,voltage 2022-12-01 2023-01-01 -a Day --empty)
  [ "$OUT" = "$EXPECTED" ]
}

# Aggregated stream data has count, average, minimum, and maximum meta values
@test "aggregated meta values" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,timestamp,irradiance$average,irradiance$minimum,irradiance$maximum,irradiance$count
pyr1,1,1669870800000,111.85453965263889,0,715.5688,1440
pyr1,1,1669957200000,126.43718182368056,0,616.50836,1440
pyr1,1,1670043600000,14.893976233333333,0,117.217224,1440
pyr1,1,1670130000000,102.06783405555555,0,577.0264,1440
EOF
)
  OUT=$(node ../src/ datums stream pyr1 timestamp,irradiance\$average,irradiance\$minimum,irradiance\$maximum,irradiance\$count 2022-12-01 2023-01-01 -a Day --empty)
  [ "$OUT" = "$EXPECTED" ]
}

@test "aggregated default meta value average" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,timestamp,irradiance
pyr1,1,1669870800000,111.85453965263889
pyr1,1,1669957200000,126.43718182368056
pyr1,1,1670043600000,14.893976233333333
pyr1,1,1670130000000,102.06783405555555
EOF
)
  OUT=$(node ../src/ datums stream pyr1 timestamp,irradiance 2022-12-01 2023-01-01 -a Day --empty)
  [ "$OUT" = "$EXPECTED" ]
}
