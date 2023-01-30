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

@test "empty timestamp" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,irradiance
pyr1,1,111.85453965263889
pyr1,1,126.43718182368056
pyr1,1,14.893976233333333
pyr1,1,102.06783405555555
EOF
)
  OUT=$(node ../src/ datums stream pyr1 irradiance 2022-12-01 2023-01-01 -a Day --empty)
  [ "$OUT" = "$EXPECTED" ]
}

@test "empty timestamp: stream skip incomplete rows" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,voltage
EOF
)
  OUT=$(node ../src/ datums stream pyr1 voltage 2022-12-01 2023-01-01 -a Day)
  [ "$OUT" = "$EXPECTED" ]
}

# We can include incomplete rows with --partial
@test "empty timestamp: include partial rows" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,irradiance,voltage
pyr1,1,111.85453965263889,
pyr1,1,126.43718182368056,
pyr1,1,14.893976233333333,
pyr1,1,102.06783405555555,
EOF
)
  OUT=$(node ../src/ datums stream pyr1 irradiance,voltage 2022-12-01 2023-01-01 -a Day --partial)
  [ "$OUT" = "$EXPECTED" ]
}

# Or include all rows, even if we're missing all relevant columns
@test "empty timestamp: include empty rows" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,voltage
pyr1,1,
pyr1,1,
pyr1,1,
pyr1,1,
EOF
)
  OUT=$(node ../src/ datums stream pyr1 voltage 2022-12-01 2023-01-01 -a Day --empty)
  [ "$OUT" = "$EXPECTED" ]
}

@test "raw datums" {
  EXPECTED=$(
  cat <<- "EOF"
sourceId,objectId,timestamp,temperature
pyr1,452,1669852813012,14.926397
pyr1,452,1669852873011,14.915987
pyr1,452,1669852933012,14.934763
pyr1,452,1669852993012,14.978647
pyr1,452,1669853053012,14.961908
pyr1,452,1669853113012,14.944155
pyr1,452,1669853173011,14.960371
pyr1,452,1669853233011,14.970785
pyr1,452,1669853293014,14.925882
pyr1,452,1669853353012,14.907618
pyr1,452,1669853413012,14.898733
pyr1,452,1669853473011,14.916494
pyr1,452,1669853533011,14.926905
pyr1,452,1669853593012,14.898226
pyr1,452,1669853653012,14.953028
pyr1,452,1669853713012,14.926905
pyr1,452,1669853773011,14.997427
pyr1,452,1669853833012,14.981203
pyr1,452,1669853893011,14.95252
pyr1,452,1669853953012,15.005278
pyr1,452,1669854013011,14.990587
pyr1,452,1669854073012,14.988039
EOF
)
  OUT=$(node ../src/ datums stream pyr1 timestamp,temperature 2022-12-01 2023-01-01)
  [ "$OUT" = "$EXPECTED" ]
}