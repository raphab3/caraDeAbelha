package httpserver

import (
	"container/heap"
	"math"
)

const (
	movementRouteSampleDistance = 0.20
	movementRouteMaxCost        = 96.0
	movementRouteMaxDetour      = 4.0
	movementRouteDetourPadding  = 6.0
)

type movementWaypoint struct {
	X float64
	Y float64
}

type movementRouteResult struct {
	waypoints []movementWaypoint
	reason    string
}

type routeNode struct {
	X int
	Y int
}

type routeQueueItem struct {
	node     routeNode
	cost     float64
	priority float64
	index    int
}

type routePriorityQueue []*routeQueueItem

func (queue routePriorityQueue) Len() int {
	return len(queue)
}

func (queue routePriorityQueue) Less(left int, right int) bool {
	return queue[left].priority < queue[right].priority
}

func (queue routePriorityQueue) Swap(left int, right int) {
	queue[left], queue[right] = queue[right], queue[left]
	queue[left].index = left
	queue[right].index = right
}

func (queue *routePriorityQueue) Push(item any) {
	queued := item.(*routeQueueItem)
	queued.index = len(*queue)
	*queue = append(*queue, queued)
}

func (queue *routePriorityQueue) Pop() any {
	old := *queue
	last := len(old) - 1
	item := old[last]
	item.index = -1
	*queue = old[:last]
	return item
}

func (hub *gameHub) resolveMovementRouteLocked(player *playerState, targetX float64, targetY float64) movementRouteResult {
	if player == nil {
		return movementRouteResult{reason: "Destino invalido"}
	}

	if !hub.isValidMovementPositionLocked(player, targetX, targetY) {
		return movementRouteResult{reason: "Destino invalido"}
	}

	if !hub.isValidMovementPositionLocked(player, player.X, player.Y) {
		return movementRouteResult{
			waypoints: []movementWaypoint{{X: targetX, Y: targetY}},
		}
	}

	if hub.isTraversableSegmentLocked(player, player.X, player.Y, targetX, targetY) {
		return movementRouteResult{
			waypoints: []movementWaypoint{{X: targetX, Y: targetY}},
		}
	}

	waypoints, ok := hub.findGridRouteLocked(player, targetX, targetY)
	if !ok {
		return movementRouteResult{reason: "Nao existe rota disponivel"}
	}

	return movementRouteResult{waypoints: waypoints}
}

func (hub *gameHub) isValidMovementPositionLocked(player *playerState, x float64, y float64) bool {
	if !hub.world.containsMovementPosition(x, y) {
		return false
	}

	return hub.world.isTraversablePosition(x, y) && hub.canPlayerAccessPositionLocked(player, x, y)
}

func (hub *gameHub) isTraversableSegmentLocked(player *playerState, fromX float64, fromY float64, toX float64, toY float64) bool {
	distance := math.Hypot(toX-fromX, toY-fromY)
	if distance <= movementRouteSampleDistance {
		return hub.isValidMovementPositionLocked(player, toX, toY)
	}

	steps := int(math.Ceil(distance / movementRouteSampleDistance))
	for step := 1; step <= steps; step++ {
		ratio := float64(step) / float64(steps)
		x := fromX + (toX-fromX)*ratio
		y := fromY + (toY-fromY)*ratio
		if !hub.isValidMovementPositionLocked(player, x, y) {
			return false
		}
	}

	return true
}

func (hub *gameHub) findGridRouteLocked(player *playerState, targetX float64, targetY float64) ([]movementWaypoint, bool) {
	start := routeNode{X: int(math.Floor(player.X)), Y: int(math.Floor(player.Y))}
	goal := routeNode{X: int(math.Floor(targetX)), Y: int(math.Floor(targetY))}

	if start == goal {
		return []movementWaypoint{{X: targetX, Y: targetY}}, true
	}

	open := &routePriorityQueue{}
	heap.Init(open)
	heap.Push(open, &routeQueueItem{
		node:     start,
		cost:     0,
		priority: routeHeuristic(start, goal),
	})

	cameFrom := make(map[routeNode]routeNode)
	costSoFar := map[routeNode]float64{start: 0}
	visited := 0
	maxVisited := int(movementRouteMaxCost*8) + 16

	for open.Len() > 0 && visited < maxVisited {
		current := heap.Pop(open).(*routeQueueItem)
		if current.cost > costSoFar[current.node] {
			continue
		}
		visited++

		if current.node == goal {
			return hub.buildRouteWaypointsLocked(player, cameFrom, start, goal, targetX, targetY)
		}

		for _, next := range routeNeighbors(current.node) {
			nextX, nextY := routeNodeCenter(next)
			if !hub.isValidMovementPositionLocked(player, nextX, nextY) {
				continue
			}
			currentX, currentY := routeNodeCenter(current.node)
			if !hub.isTraversableSegmentLocked(player, currentX, currentY, nextX, nextY) {
				continue
			}

			nextCost := current.cost + 1
			if nextCost > movementRouteMaxCost {
				continue
			}
			if existing, ok := costSoFar[next]; ok && nextCost >= existing {
				continue
			}

			costSoFar[next] = nextCost
			cameFrom[next] = current.node
			heap.Push(open, &routeQueueItem{
				node:     next,
				cost:     nextCost,
				priority: nextCost + routeHeuristic(next, goal),
			})
		}
	}

	return nil, false
}

func (hub *gameHub) buildRouteWaypointsLocked(player *playerState, cameFrom map[routeNode]routeNode, start routeNode, goal routeNode, targetX float64, targetY float64) ([]movementWaypoint, bool) {
	nodes := []routeNode{goal}
	for current := goal; current != start; {
		previous, ok := cameFrom[current]
		if !ok {
			return nil, false
		}
		current = previous
		nodes = append(nodes, current)
	}

	for left, right := 0, len(nodes)-1; left < right; left, right = left+1, right-1 {
		nodes[left], nodes[right] = nodes[right], nodes[left]
	}

	straightDistance := math.Hypot(targetX-player.X, targetY-player.Y)
	routeCost := float64(len(nodes) - 1)
	maxAllowedCost := straightDistance*movementRouteMaxDetour + movementRouteDetourPadding
	if routeCost > maxAllowedCost || routeCost > movementRouteMaxCost {
		return nil, false
	}

	waypoints := make([]movementWaypoint, 0, len(nodes))
	for index, node := range nodes {
		if index == 0 {
			continue
		}

		if node == goal {
			waypoints = append(waypoints, movementWaypoint{X: targetX, Y: targetY})
			continue
		}

		x, y := routeNodeCenter(node)
		waypoints = append(waypoints, movementWaypoint{X: x, Y: y})
	}

	return waypoints, len(waypoints) > 0
}

func routeNeighbors(node routeNode) []routeNode {
	return []routeNode{
		{X: node.X + 1, Y: node.Y},
		{X: node.X - 1, Y: node.Y},
		{X: node.X, Y: node.Y + 1},
		{X: node.X, Y: node.Y - 1},
	}
}

func routeHeuristic(from routeNode, to routeNode) float64 {
	return math.Abs(float64(to.X-from.X)) + math.Abs(float64(to.Y-from.Y))
}

func routeNodeCenter(node routeNode) (float64, float64) {
	return float64(node.X) + 0.5, float64(node.Y) + 0.5
}
