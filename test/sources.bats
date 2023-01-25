# We should get a list of all sources
@test "solarnetwork list all sources" {
  run node ../src/ projects source
  GOOD=$(cat snippets/all_sources.txt)
  [ "$output" = "$GOOD" ]
}

# We should be able to filter explicitly using the sourceId
@test "solarnetwork pyr1 sources" {
  run node ../src/ projects source pyr1
  GOOD=$(cat snippets/pyr1_sources.txt)
  [ "$output" = "$GOOD" ]
}
@test "solarnetwork inv1 sources" {
  run node ../src/ projects source inv1
  GOOD=$(cat snippets/inv1_sources.txt)
  [ "$output" = "$GOOD" ]
}