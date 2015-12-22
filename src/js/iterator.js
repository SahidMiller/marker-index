import Node from './node'
import {addToSet} from './helpers'
import {compare, isZero, traversal, traverse} from './point-helpers'

export default class Iterator {
  constructor (markerIndex) {
    this.markerIndex = markerIndex
  }

  reset () {
    this.currentNode = this.markerIndex.root
    this.currentNodePosition = this.currentNode ? this.currentNode.leftExtent : null
    this.leftAncestorPosition = {row: 0, column: 0}
    this.rightAncestorPosition = {row: Infinity, column: Infinity}
    this.leftAncestorPositionStack = []
    this.rightAncestorPositionStack = []
  }

  insertMarkerStart (markerId, startPosition, endPosition) {
    this.reset()

    if (!this.currentNode) {
      let node = new Node(null, startPosition)
      this.markerIndex.root = node
      return node
    }

    while (true) {
      let comparison = compare(startPosition, this.currentNodePosition)
      if (comparison === 0) {
        this.markRight(markerId, startPosition, endPosition)
        return this.currentNode
      } else if (comparison < 0) {
        this.markRight(markerId, startPosition, endPosition)
        if (this.currentNode.left) {
          this.descendLeft()
        } else {
          this.insertLeftChild(startPosition)
          this.descendLeft()
          this.markRight(markerId, startPosition, endPosition)
          return this.currentNode
        }
      } else { // startPosition > this.currentNodePosition
        if (this.currentNode.right) {
          this.descendRight()
        } else {
          this.insertRightChild(startPosition)
          this.descendRight()
          this.markRight(markerId, startPosition, endPosition)
          return this.currentNode
        }
      }
    }
  }

  insertMarkerEnd (markerId, startPosition, endPosition) {
    this.reset()

    if (!this.currentNode) {
      let node = new Node(null, endPosition)
      this.markerIndex.root = node
      return node
    }

    while (true) {
      let comparison = compare(endPosition, this.currentNodePosition)
      if (comparison === 0) {
        this.markLeft(markerId, startPosition, endPosition)
        return this.currentNode
      } else if (comparison < 0) {
        if (this.currentNode.left) {
          this.descendLeft()
        } else {
          this.insertLeftChild(endPosition)
          this.descendLeft()
          this.markLeft(markerId, startPosition, endPosition)
          return this.currentNode
        }
      } else { // endPosition > this.currentNodePosition
        this.markLeft(markerId, startPosition, endPosition)
        if (this.currentNode.right) {
          this.descendRight()
        } else {
          this.insertRightChild(endPosition)
          this.descendRight()
          this.markLeft(markerId, startPosition, endPosition)
          return this.currentNode
        }
      }
    }
  }

  insertSpliceBoundary (position, isInsertionEnd) {
    this.reset()

    while (true) {
      let comparison = compare(position, this.currentNodePosition)
      if (comparison === 0 && !isInsertionEnd) {
        return this.currentNode
      } else if (comparison < 0) {
        if (this.currentNode.left) {
          this.descendLeft()
        } else {
          this.insertLeftChild(position)
          return this.currentNode.left
        }
      } else { // position > this.currentNodePosition
        if (this.currentNode.right) {
          this.descendRight()
        } else {
          this.insertRightChild(position)
          return this.currentNode.right
        }
      }
    }
  }

  findIntersecting (start, end, resultSet) {
    this.reset()
    if (!this.currentNode) return

    while (true) {
      if (compare(start, this.currentNodePosition) < 0) {
        if (this.currentNode.left) {
          this.checkIntersection(start, end, resultSet)
          this.descendLeft()
        } else {
          break
        }
      } else {
        if (this.currentNode.right) {
          this.checkIntersection(start, end, resultSet)
          this.descendRight()
        } else {
          break
        }
      }
    }

    do {
      this.checkIntersection(start, end, resultSet)
      this.moveToSuccessor()
    } while (this.currentNode && compare(this.currentNodePosition, end) <= 0)
  }

  findContaining (position, resultSet) {
    this.reset()
    if (!this.currentNode) return

    while (true) {
      this.checkIntersection(position, position, resultSet)

      if (compare(position, this.currentNodePosition) < 0) {
        if (this.currentNode.left) {
          this.descendLeft()
        } else {
          break
        }
      } else {
        if (this.currentNode.right) {
          this.descendRight()
        } else {
          break
        }
      }
    }
  }

  findContainedIn (start, end, resultSet) {
    this.reset()
    if (!this.currentNode) return

    this.seekToFirstNodeGreaterThanOrEqualTo(start)

    let started = new Set()
    while (this.currentNode && compare(this.currentNodePosition, end) <= 0) {
      addToSet(started, this.currentNode.startMarkerIds)
      this.currentNode.endMarkerIds.forEach(function (markerId) {
        if (started.has(markerId)) {
          resultSet.add(markerId)
        }
      })
      this.moveToSuccessor()
    }
  }

  findStartingIn (start, end, resultSet) {
    this.reset()
    if (!this.currentNode) return

    this.seekToFirstNodeGreaterThanOrEqualTo(start)

    while (this.currentNode && compare(this.currentNodePosition, end) <= 0) {
      addToSet(resultSet, this.currentNode.startMarkerIds)
      this.moveToSuccessor()
    }
  }

  findEndingIn (start, end, resultSet) {
    this.reset()
    if (!this.currentNode) return

    this.seekToFirstNodeGreaterThanOrEqualTo(start)

    while (this.currentNode && compare(this.currentNodePosition, end) <= 0) {
      addToSet(resultSet, this.currentNode.endMarkerIds)
      this.moveToSuccessor()
    }
  }

  findMaximalIntersecting (start, end, resultSet) {
    this.reset()
    if (!this.currentNode) return

    let containingStart

    while (true) {
      let comparison = compare(start, this.currentNodePosition)

      if (comparison < 0) {
        if (this.currentNode.leftMarkerIds.size > 0) {
          containingStart = new Set(this.currentNode.leftMarkerIds)
          break
        } else if (this.currentNode.left) {
          this.descendLeft()
        } else {
          break
        }
      } else if (comparison === 0) {
        containingStart = new Set()
        let {leftMarkerIds, rightMarkerIds} = this.currentNode
        leftMarkerIds.forEach(function (id) {
          if (rightMarkerIds.has(id)) containingStart.add(id)
        })
        break
      } else { // comparison > 0
        if (this.currentNode.rightMarkerIds.size > 0) {
          containingStart = new Set(this.currentNode.rightMarkerIds)
          break
        } else if (this.currentNode.right) {
          this.descendRight()
        } else {
          break
        }
      }
    }

    containingStart = containingStart || new Set()

    if (containingStart.size > 1) {
      this.seekToMinimalStartNode(containingStart)
    }
  }

  dump () {
    this.reset()

    while (this.currentNode && this.currentNode.left) this.descendLeft()

    let snapshot = {}

    while (this.currentNode) {
      this.currentNode.startMarkerIds.forEach(markerId => {
        snapshot[markerId] = {start: this.currentNodePosition, end: null}
      })

      this.currentNode.endMarkerIds.forEach(markerId => {
        snapshot[markerId].end = this.currentNodePosition
      })

      this.moveToSuccessor()
    }

    return snapshot
  }

  seekToFirstNodeGreaterThanOrEqualTo (position) {
    while (true) {
      let comparison = compare(position, this.currentNodePosition)

      if (comparison === 0) {
        break
      } else if (comparison < 0) {
        if (this.currentNode.left) {
          this.descendLeft()
        } else {
          break
        }
      } else {
        if (this.currentNode.right) {
          this.descendRight()
        } else {
          break
        }
      }
    }

    if (compare(this.currentNodePosition, position) < 0) this.moveToSuccessor()
  }

  markLeft (markerId, startPosition, endPosition) {
    if (!isZero(this.currentNodePosition) && compare(startPosition, this.leftAncestorPosition) <= 0 && compare(this.currentNodePosition, endPosition) <= 0) {
      this.currentNode.leftMarkerIds.add(markerId)
    }
  }

  markRight (markerId, startPosition, endPosition) {
    if (compare(this.leftAncestorPosition, startPosition) < 0 &&
      compare(startPosition, this.currentNodePosition) <= 0 &&
      compare(this.rightAncestorPosition, endPosition) <= 0) {
      this.currentNode.rightMarkerIds.add(markerId)
    }
  }

  ascend () {
    if (this.currentNode.parent) {
      if (this.currentNode.parent.left === this.currentNode) {
        this.currentNodePosition = this.rightAncestorPosition
      } else {
        this.currentNodePosition = this.leftAncestorPosition
      }
      this.leftAncestorPosition = this.leftAncestorPositionStack.pop()
      this.rightAncestorPosition = this.rightAncestorPositionStack.pop()
      this.currentNode = this.currentNode.parent
    } else {
      this.currentNode = null
      this.currentNodePosition = null
      this.leftAncestorPosition = {row: 0, column: 0}
      this.rightAncestorPosition = {row: Infinity, column: Infinity}
    }
  }

  descendLeft () {
    this.leftAncestorPositionStack.push(this.leftAncestorPosition)
    this.rightAncestorPositionStack.push(this.rightAncestorPosition)

    this.rightAncestorPosition = this.currentNodePosition
    this.currentNode = this.currentNode.left
    this.currentNodePosition = traverse(this.leftAncestorPosition, this.currentNode.leftExtent)
  }

  descendRight () {
    this.leftAncestorPositionStack.push(this.leftAncestorPosition)
    this.rightAncestorPositionStack.push(this.rightAncestorPosition)

    this.leftAncestorPosition = this.currentNodePosition
    this.currentNode = this.currentNode.right
    this.currentNodePosition = traverse(this.leftAncestorPosition, this.currentNode.leftExtent)
  }

  moveToSuccessor () {
    if (!this.currentNode) return

    if (this.currentNode.right) {
      this.descendRight()
      while (this.currentNode.left) {
        this.descendLeft()
      }
    } else {
      while (this.currentNode.parent && this.currentNode.parent.right === this.currentNode) {
        this.ascend()
      }
      this.ascend()
    }
  }

  insertLeftChild (position) {
    this.currentNode.left = new Node(this.currentNode, traversal(position, this.leftAncestorPosition))
  }

  insertRightChild (position) {
    this.currentNode.right = new Node(this.currentNode, traversal(position, this.currentNodePosition))
  }

  checkIntersection (start, end, resultSet) {
    if (compare(this.leftAncestorPosition, end) <= 0 && compare(start, this.currentNodePosition) <= 0) {
      addToSet(resultSet, this.currentNode.leftMarkerIds)
    }

    if (compare(start, this.currentNodePosition) <= 0 && compare(this.currentNodePosition, end) <= 0) {
      addToSet(resultSet, this.currentNode.startMarkerIds)
      addToSet(resultSet, this.currentNode.endMarkerIds)
    }

    if (compare(this.currentNodePosition, end) <= 0 && compare(start, this.rightAncestorPosition) <= 0) {
      addToSet(resultSet, this.currentNode.rightMarkerIds)
    }
  }
}
