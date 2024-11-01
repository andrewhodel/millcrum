var Millcrum = function(tool) {
	this.gcode = '';
	this.debug = false;
	this.tool = tool;

	this.svgLib = new Svg();

};

Millcrum.prototype.addDegrees = function(base,mod) {
	// this function expects a 360 degree number
	// base and mod must be between 0-360
	var v = base+mod;
	if (v > 360) {
		v = 360-v;
	} else if (v < 0) {
		v = 360+v;
	}
	return Math.abs(v);
};

Millcrum.prototype.surface = function(x,y) {

	if (typeof(globalSx) != 'undefined') {
		globalSx = x;
		globalSy = y;
	}

	// run the canvas_init function
	canvas_init();

};

Millcrum.prototype.pointInPolygon = function(point, points) {
	// check if a point is inside a polygon

	// The solution is to compare each side of the polygon to the Y (vertical) coordinate of the test
	// point, and compile a list of nodes, where each node is a point where one side crosses the Y
	// threshold of the test point. In this example, eight sides of the polygon cross the Y threshold,
	// while the other six sides do not.  Then, if there are an odd number of nodes on each side of
	// the test point, then it is inside the polygon; if there are an even number of nodes on each
	// side of the test point, then it is outside the polygon.

	var j = points.length-1;
	var oddNodes = false;
/*
	// this would return true if all points were inside and not touching the path of points
	for (var c=0; c<points.length; c++) {
		// if ((thisY < pointY AND thisjY >= pointY) OR (thisjY < pointY AND thisY >= pointY))
		if ((points[c][1] < point[1] && points[j][1] >= point[1]) || (points[j][1] < point[1] && points[c][1] >= point[1])) {
			// if (thisX+(pointY-thisY)/(thisjY-thisY)*(thisjX-thisX) < pointX)
			if (points[c][0]+(point[1]-points[c][1])/(points[j][1]-points[c][1])*(points[j][0]-points[c][0]) < point[0]) {
				oddNodes =! oddNodes;
			}
		}
		j = c;
	}
*/
	// this would return true if all points were inside or touching the path of points
	for (var c=0; c<points.length; c++) {
		// if ((thisY < pointY AND thisjY >= pointY) OR (thisjY < pointY AND thisY >= pointY))
		if ((points[c][1] <= point[1] && points[j][1] >= point[1]) || (points[j][1] <= point[1] && points[c][1] >= point[1])) {
			// if (thisX+(pointY-thisY)/(thisjY-thisY)*(thisjX-thisX) < pointX)
			if (points[c][0]+(point[1]-points[c][1])/(points[j][1]-points[c][1])*(points[j][0]-points[c][0]) <= point[0]) {
				oddNodes =! oddNodes;
			}
		}
		j = c;
	}

	return oddNodes;

};

//console.log(Millcrum.pointInPolygon([5,5],[[0,0],[10,0],[10,10],[0,10]]));

Millcrum.prototype.linesIntersection = function(l1start,l1end,l2start,l2end) {
	// check if 2 lines will intersect and return the point at which they do

	var denom, a, b, num1, num2, result = {error:true,x:null,y:null,parallel:false};
	denom = ((l2end[1] - l2start[1]) * (l1end[0] - l1start[0])) - ((l2end[0] - l2start[0]) * (l1end[1] - l1start[1]));

	if (denom == 0) {
		// they are parallel
		result.parallel = true;
		return result;
	}

	a = l1start[1] - l2start[1];
	b = l1start[0] - l2start[0];
	num1 = ((l2end[0] - l2start[0]) * a) - ((l2end[1] - l2start[1]) * b);
	num2 = ((l1end[0] - l1start[0]) * a) - ((l1end[1] - l1start[1]) * b);
	a = num1/denom;
	b = num2/denom;

	// intersection point
	result.x = l1start[0] + (a * (l1end[0] - l1start[0]));
	result.y = l1start[1] + (a * (l1end[1] - l1start[1]));

	if (a > 0 && a < 1 && b > 0 && b < 1) {
		// we can be positive that they intersect
		// keep in mind this function does not consider 2 lines meeting being an intersect
		// so result.error would be true if they meet
		result.error = false;
	}

	// if result.error == true BUT .x and .y are not null then the lines WOULD eventually intersect

	return result;
};

Millcrum.prototype.distanceFormula = function(p1,p2) {
	// get the distance between p1 and p2
	var x1 = p1[0];
	var y1 = p1[1];
	var x2 = p2[0];
	var y2 = p2[1];
	var a = (x2-x1)*(x2-x1);
	var b = (y2-y1)*(y2-y1);
	return Math.sqrt(a+b);
};

Millcrum.prototype.newPointFromDistanceAndAngle = function(pt,ang,distance) {
	// use cos and sin to get a new point with an angle
	// and distance from an existing point
	// pt = [x,y]
	// ang = in degrees
	// distance = N
	var r = [];
	r.push(pt[0]+(distance*Math.cos(ang*Math.PI/180)));
	r.push(pt[1]+(distance*Math.sin(ang*Math.PI/180)));
	return r;
};

Millcrum.prototype.generateArc = function(startDeg,endDeg,r,toolDiameter) {

	if (startDeg == 360) {
		startDeg = 0;
	}

	// for an arc we have to start from the center
	// then using the fragment count we draw that number of triangles
	// extruding from the center point to r and use the outside edge
	// of those triangles to generate the lines for the arc
	// a higher number of fragments will render a smoother arc
	var f = 40;

	// degreeStep is 360/f (total fragments)
	// this is the angle we will move each step to create the fragments
	var degreeStep = 360/f;

	// create the path array
	var p = [];

	// to get the first point in the arc path, we need to get a new point from distance and angle
	// which has an angle of startDeg and a distance of r
	p.push(this.newPointFromDistanceAndAngle([0,0],startDeg,r));

	var fDist = this.distanceFormula(p[0],this.newPointFromDistanceAndAngle([0,0],this.addDegrees(startDeg,degreeStep),r));

	// normalize mm and inches to mm here just for this
	var desired = toolDiameter/2;
	if (this.tool.units != 'mm') {
		// divide it by 25.4 to get inch value
		desired = desired/25.4
	}

	// we can automatically calculate the number of fragments by recursively looping
	// and increasing the number until a sample line segment is less than this.tool.diameter/2
	while (fDist > desired) {
		// increase f
		f = f*1.5;

		// recalculate the degreeStep
		degreeStep = 360/f;

		// calculate a fragment distance from the first point
		fDist = this.distanceFormula(p[0],this.newPointFromDistanceAndAngle([0,0],this.addDegrees(startDeg,degreeStep),r));
	}

	//console.log('total number of steps '+f+' at '+degreeStep+' degrees which is 360/'+f+' and a distance of '+fDist);

	// now get the number of fragments to actually create, based on the total degrees
	// which is the absolute value of startDeg-endDeg / 360 then multiplied by the total number of fragments
	var totalFrags = (Math.abs(startDeg-endDeg)/360)*f;
	for (var c=1; c<totalFrags; c++) {
		p.push(this.newPointFromDistanceAndAngle([0,0],this.addDegrees(startDeg,c*degreeStep),r));
	}

	return p;

};

Millcrum.prototype.removeOpposingXs = function(path) {
	// when an inside offset path is created and there is a rounded corner,
	// the seperation of the offset path and inside path can be greater than the distance
	// to the point at which 2 points on the original path would intersect.
	//
	// that would create an X, which is not right so we need to go through and cut those off
	// 
	// the path direction is expected to be counter clockwise for this to work
	var clean = function(path, c, prev, cur) {

		for (var d=0; d<path.length; d++) {
			if (c == d) {
				continue;
			}
			if (d == 0) {
				var pr = path[path.length-1];
			} else if (d == path.length-1) {
				var pr = path[0];
			} else {
				var pr = path[d-1];
			}
			var cu = path[d];
			var i = this.linesIntersection(prev, cur, pr, cu);

			if (!i.error) {
				// the line between prev and cur intersects with the line between pr and cu
				// we need to remove all points after c and up to d, if d == 0 we need to remove all points after c and up to path.length-1
				//console.log('remove between '+c+' and '+d);
				if (d == 0) {
					path.splice(c, path.length-1-c);
				} else if (c > d) {
					path.splice(c, path.length-1);
					path.splice(0, d-1);
				} else {
					path.splice(c, d-c);
				}
				path.splice(c, 0, [i.x, i.y]);
				if (c > d) {
					path[0] = path[path.length-1];
				}
				break;
			}
		}

	}.bind({linesIntersection: this.linesIntersection});

	// now loop through all the lines in path and add any points of intersection
	// cutting off any points after the intersection
	for (var c=0; c<path.length; c++) {
		if (c == 0) {
			var prev = path[path.length-1];
		} else if (c == path.length-1) {
			var prev = path[0];
		} else {
			var prev = path[c-1];
		}
		var cur = path[c];
		//console.log('point', c, 'of', path.length-1);

		// this will remove all opposing X paths that were created
		clean(path, c, prev, cur);

	}

	return path;

};

Millcrum.prototype.intersect = function(l1start, l1end, l2start, l2end) {

	/*
	Line-Line Intersection

	One of the most common tasks you will find in geometry problems is line intersection. Despite the fact that it is so common, a lot of coders still have trouble with it. The first question is, what form are we given our lines in, and what form would we like them in? Ideally, each of our lines will be in the form Ax+By=C, where A, B and C are the numbers which define the line. However, we are rarely given lines in this format, but we can easily generate such an equation from two points. Say we are given two different points, (x1, y1) and (x2, y2), and want to find A, B and C for the equation above. We can do so by setting

	A = y2-y1
	B = x1-x2
	C = A*x1+B*y1

	Regardless of how the lines are specified, you should be able to generate two different points along the line, and then generate A, B and C. Now, lets say that you have lines, given by the equations:

	A1x + B1y = C1
	A2x + B2y = C2

	To find the point at which the two lines intersect, we simply need to solve the two equations for the two unknowns, x and y.
	*/

	var ret = {x: null, y: null};

	var a1 = l1end[1]-l1start[1];
	var b1 = l1start[0]-l1end[0];
	var c1 = (a1*l1start[0])+(b1*l1start[1]);

	var a2 = l2end[1]-l2start[1];
	var b2 = l2start[0]-l2end[0];
	var c2 = (a2*l2start[0])+(b2*l2start[1]);

	var det = (a1*b2)-(a2*b1);
	if (det == 0) {
		// lines are parallel
	} else {
		ret.x = ((b2*c1) - (b1*c2))/det;
		ret.y = ((a1*c2) - (a2*c1))/det;
	}

	return ret;
}

Millcrum.prototype.applyLimit = function(minX, minY, maxX, maxY, path) {

	/*
	var tool = {units: 'mm', diameter: 6.35, passDepth: 4, step: 1, rapid: 2000, plunge: 100, cut: 600, zClearance: 5, returnHome: true};
	var mc = new Millcrum(tool);
	mc.surface(100,50);
	var rect = {type:'rect',xLen:80,yLen:20,name:'50mm square'};
	mc.cut('centerOnPath', rect, 4, [0,0]);
	mc.get();
	*/

	console.log('apply x and y limits');
	console.log('maxX', maxX);
	console.log('maxY', maxY);

	// apply limits to a path
	// remove everything that doesn't fit into the window/pane/sheet
	//
	// this expects a CCW path
	//
	// there are 4 lines, starting at minX, minY which define the limit
	var l = [];
	l.push([minX, minY]);
	l.push([maxX, minY]);
	l.push([maxX, maxY]);
	l.push([minX, maxY]);
	l.push([minX, minY]);

	// first label all points in path as inside or outside of the clip path
	var io = [];
	for (var c=0; c<path.length; c++) {
		if (this.pointInPolygon(path[c], l)) {
			// this point is inside the clip path
			io.push({loc: 'i', p: path[c]});
		} else {
			io.push({loc: 'o', p: path[c]});
		}

		// this is a CCW path, label if the previous point
		// was inside or outside the polygon
		if (c>0) {
			io[io.length-1].origin = io[io.length-2].loc;
		}

	}
	io[0].origin = io[io.length-1].loc;

	// now find each intersection for the points which have
	// 	an origin of inside and location of outside
	// 	or
	// 	and origin out outside and location of inside

	for (var c=0; c<io.length; c++) {
		var cur = io[c];
		if (c == 0) {
			var prev = io[io.length-1];
		} else {
			var prev = io[c-1];
		}

		// test intersections with all lines in l
		// and find the point for the closest one
		var shortest_dist = -1;
		var closest_intersection_point = [];
		for (var d=0; d<l.length; d++) {
			var cu = l[d];
			if (d == 0) {
				var pr = l[l.length-1];
			} else {
				var pr = l[d-1];
			}
			var p = this.linesIntersection(prev.p, cur.p, pr, cu)
			//console.log(c, 'checking for intersection between');
			//console.log(prev.p, cur.p);
			//console.log(pr, cu);
			if (p.x != null && p.y != null) {
			//if (!p.error) {
				var dist = Math.abs(this.distanceFormula(cur.p, [p.x, p.y]));
				if (cur.loc == 'i' && cur.origin == 'o') {
					// we need the distance from prev
					var dist = Math.abs(this.distanceFormula(prev.p, [p.x, p.y]));
				}
				//console.log(io[c].p[0], ',', io[c].p[1], 'dist', dist, p);
				if (dist < shortest_dist || shortest_dist == -1) {
					//console.log('found shortest dist', dist);
					shortest_dist = dist;
					closest_intersection_point = [p.x, p.y];
				}
			}
		}

		if (cur.loc == 'i' && cur.origin == 'o') {
			// we are changing the previous intersection
			prev.intersection = closest_intersection_point;
			cur.intersection = [];
		} else {
			cur.intersection = closest_intersection_point;
		}
	}

	//console.log('io', io);

	// now move the points which are to be moved and remove the points which are not needed
	path = [];
	for (var c=0; c<io.length; c++) {
		var cur = io[c];
		if (c == 0) {
			var prev = io[io.length-1];
		} else if (c == io.length-1) {
			var prev = io[0];
		} else {
			var prev = io[c-1];
		}

		if (cur.loc == 'i' && cur.origin == 'i') {
			// this point originates from a point inside and is itself inside
			path.push(cur.p);
		} else {
			if (cur.intersection.length == 2) {
				path.push(cur.intersection);
			} else {
				path.push(cur.p);
			}
		}

		// this handles if a point is completely outside the bounds
		if (path[c][0] > maxX) {
			path[c][0] = maxX;
		} else if (path[c][0] < minX) {
			path[c][0] = minX;
		}
		if (path[c][1] > maxY) {
			path[c][1] = maxY;
		} else if (path[c][1] < minY) {
			path[c][1] = minY;
		}

	}

	//console.log(path);

	return path;
};

Millcrum.prototype.generateOffsetPath = function(type, basePath, offsetDistance) { 
	// generates an offset path from basePath
	// type of either inside or outside
	// offsetDistance determines how far away it is

	//console.log('##GENERATING OFFSET PATH##');

	// first create an array of midpoints and angles for the offset path
	var newMidpoints = [];
	// we also need to find the line with the longest distance
	longestLine = 0;

	for (var c=1; c<basePath.length; c++) {
		// we are looping through each point starting with 1 instead of 0
		// which means using currentPoint and previousPoint we are looping through
		// each line segment starting with the first

		var previousPoint = basePath[c-1];
		var currentPoint = basePath[c];

		// get the length of the line
		var len = this.distanceFormula(currentPoint,previousPoint);

		if (len < .01) {
			// any line this short we just skip, if not rounding errors will occur and offset paths will be messed up
			continue;
		}

		// get the deltas for X and Y to calculate the line angle with atan2
		var deltaX = currentPoint[0]-previousPoint[0];
		var deltaY = currentPoint[1]-previousPoint[1];

		// get the line angle
		var ang = Math.atan2(deltaY,deltaX);

		// convert it to degrees for later math with addDegree
		ang = ang*180/Math.PI;
		//console.log('\n##LINE '+c+' at '+Math.round(ang)+' degrees from '+previousPoint[0]+', '+previousPoint[1]+' to '+currentPoint[0]+', '+currentPoint[1]+'##');
		//console.log('  LENGTH '+len);

		if (len > longestLine) {
			// update longestLine
			longestLine = len;
		}

		// here we have the angle of the line segment and we need to move it
		// for it to go inside the object or outside the object
		// on a path of ang-90 or the opposite of ang-90 (example ang of 90 would be either 0 or opposite 180)

		var movedLineAng = this.addDegrees(ang,-90);
		if (type == 'inside') {
			// reverse the angle
			movedLineAng = this.addDegrees(movedLineAng,180);
		}
		//console.log('  offsetting '+offsetDistance+' '+type);

		// now split the line at the middle length and get that point
		// then get the coords of the midpoint on the new lines calculated
		// from outsideAng, insideAng and this.tool.diameter (offset)
		// from those midpoints and with the known (perpendicular) line angles you can
		// extend the new lines out

		// get the point coordinate at midpoint of this line
		var midpoint = this.newPointFromDistanceAndAngle(previousPoint,ang,len/2);
		//console.log('  line midpoint');
		//console.log(midpoint);

		// draw the midpoint for testing
		//drawPath([midpoint], this.tool, 'centerOnPath', 20, true, c);

		// now we need the new midpoint for pathAng
		// from midpoint with the this.tool.diameter/2 for a distance
		var movedLineMidPoint = this.newPointFromDistanceAndAngle(midpoint,movedLineAng,offsetDistance);
		//console.log('  movedLineMidPoint');
		//console.log(movedLineMidPoint);

		newMidpoints.push([movedLineMidPoint,ang]);

		// draw the offset midpoint for testing
		//drawPath([movedLineMidPoint], this.tool, 'centerOnPath', 20, true, c);

	}

	//console.log('##newMidpoints##');
	//console.log(newMidpoints);

	// we will add (longestLine+offsetDistance)*2 to each new line half that we create
	// so that we can find the point of intersection and be sure that the line is long
	// enough to intersect
	var lenForLine = (longestLine+offsetDistance)*2;

	// this is the path we will return
	var rPath = [];

	// now we can loop through the newly offset path midpoints and use the angles
	// to extend lines to the point that they interesect with their adjacent line
	// and that will close the path
	for (c=0; c<newMidpoints.length; c++) {

		var currentMidPoint = newMidpoints[c];
		if (c == 0) {
			var previousMidPoint = newMidpoints[newMidpoints.length-1];
		} else {
			var previousMidPoint = newMidpoints[c-1];
		}

		//console.log('  midpoint #'+c);

		// since we have the midpoint, first we have to generate the test lines
		// the current mid point is extended at it's opposite angle
		// and the previous at it's angle
		var currentMidPointEndPoint = this.newPointFromDistanceAndAngle(currentMidPoint[0],this.addDegrees(currentMidPoint[1],180),lenForLine);
		var previousMidPointEndPoint = this.newPointFromDistanceAndAngle(previousMidPoint[0],previousMidPoint[1],lenForLine);

		// now using the 2 lines, we need to find the intersection point of them
		// this will give us a single point which is the START point for the current line and
		// the END point for the previous line
		var iPoint = this.linesIntersection(previousMidPoint[0],previousMidPointEndPoint,currentMidPoint[0],currentMidPointEndPoint);
		//console.log('  intersection point for current mid point in CW');
		//console.log(iPoint);

		if (rPath.length > 0) {
			// if there are no points in the path we have to find a first point even if there was no intersection
			if (type == 'inside' && !this.pointInPolygon([iPoint.x, iPoint.y], basePath)) {
				// this point is not in the base path, no need to add it
				console.log('intersected inside point outside of base path');
			} else {
				rPath.push([iPoint.x,iPoint.y]);
			}
		} else {
			// add the point to the path if it was a proper intersection point
			if (!iPoint.error) {
				if (type == 'inside' && !this.pointInPolygon([iPoint.x, iPoint.y], basePath)) {
					console.log('intersected inside point outside of base path');
				} else {
					rPath.push([iPoint.x,iPoint.y]);
				}
			}
		}

	}

	// if any points are undefined, remove them
	for (var c=rPath.length-1; c>=0; c--) {
		if (typeof(rPath[c]) == 'undefined') {
			rPath.splice(c, 1);
		}
	}

	// then we need to add a point to the end of rPath which goes back to the initial point for rPath
	rPath.push(rPath[0]);

	// clip the messed up X things from the corners
	rPath = this.removeOpposingXs(rPath);

	if (rPath.length == 1) {
		// path not needed
		return false;
	} else {
		// return the newly offset toolpath
		return rPath;
	}

};

Millcrum.prototype.cut = function(cutType, obj, depth, startPos, config) {

	if (typeof(depth) == 'undefined') {
		// default depth of a cut is the tool defined passDepth
		depth = this.tool.passDepth;
	}

	if (typeof(startPos) == 'undefined') {
		// default start position is X0 Y0
		startPos = [0,0];
	}

	if (typeof(config) != 'object') {

		var config = {};

		if (typeof(config.useConventionalCut) == 'undefined') {
			// default cut direction is climb
			config.useConventionalCut = false;
		}
	}

	// finish setting config options
	if (typeof(config.tabs) == 'undefined') {
		// default is to not use tabs
		config.tabs = false;
	} else if (config.tabs == true) {
		// need to set defaults for using tabs if they aren't set
		// by the user
		if (typeof(config.tabHeight) == 'undefined') {
			// default height is 2, sure hope you are using mm
			config.tabHeight = 2;
		}
		if (typeof(config.tabSpacing) == 'undefined') {
			// default tab spacing is 5 times tool.diameter
			config.tabSpacing = this.tool.diameter*5;
		}
		if (typeof(config.tabWidth) == 'undefined') {
			// default tab width is 2 times tool.diameter
			config.tabWidth = this.tool.diameter*2;
		}
	}

	//console.log('generating cut operation:');
	//console.log('##tool##');
	//console.log(this.tool);
	//console.log('##cutType##');
	//console.log(cutType);
	//console.log('##obj.type##');
	//console.log(obj.type);
	//console.log('##depth##');
	//console.log(depth);
	//console.log('##startPos##');
	//console.log(startPos);

	var basePath = [];

	// these all generate a climb cut
	// which is CCW from 0,0
	// a conventional cut would be CW from 0,0
	// you can just reverse the path to get a conv cut
	if (obj.type == 'rect') {
		// for a rectangle we must generate a path using xLen and yLen

		// if there's a obj.cornerRadius set then we need to generate a rect with
		// rounded corners
		if (typeof(obj.cornerRadius) != 'undefined') {

			// we start with obj.cornerRadius,0 as we create the cut path
			basePath.push([obj.cornerRadius,0]);

			// next the bottom right
			// we need to subtract obj.cornerRadius (a distance) from X on this point
			// to make room for the arc
			basePath.push([obj.xLen-obj.cornerRadius,0]);

			// now we need to generate an arc which goes from obj.xLen-obj.cornerRadius,0
			// to obj.xLen,obj.cornerRadius (this will be the rounded bottom right corner)

			// first we have to generate an arc that goes from 270 to 360 degrees
			var arcPath = this.generateArc(270,360,obj.cornerRadius,this.tool.diameter);

			// and we need the diffs
			var xDiff = obj.xLen-obj.cornerRadius - arcPath[0][0];
			var yDiff = 0 - arcPath[0][1];

			// now we move the arc to that point while adding it to the basePath
			for (a=1; a<arcPath.length; a++) {
				// add each segment of the arc path to the basePath
				// we don't need the first as there is already a user defined point there so a=1
				basePath.push([arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
			}

			// that will have generated a path from the right of the bottom line in the rect
			// to the bottom of the right line in the rect
			// now just create another point to finish the right side of the rect, to the next corner
			basePath.push([obj.xLen,obj.yLen-obj.cornerRadius]);

			// now repeat for the other corners

			// TR CORNER
			var arcPath = this.generateArc(360,90,obj.cornerRadius,this.tool.diameter);
			var xDiff = obj.xLen - arcPath[0][0];
			var yDiff = obj.yLen-obj.cornerRadius - arcPath[0][1];
			for (a=1; a<arcPath.length; a++) {
				basePath.push([arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
			}
			basePath.push([obj.cornerRadius,obj.yLen]);

			// TL CORNER
			// SIDE 3
			var arcPath = this.generateArc(90,180,obj.cornerRadius,this.tool.diameter);
			var xDiff = obj.cornerRadius - arcPath[0][0];
			var yDiff = obj.yLen - arcPath[0][1];
			for (a=1; a<arcPath.length; a++) {
				basePath.push([arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
			}
			basePath.push([0,obj.cornerRadius]);

			// BL CORNER
			var arcPath = this.generateArc(180,270,obj.cornerRadius,this.tool.diameter);
			var xDiff = 0 - arcPath[0][0];
			var yDiff = obj.cornerRadius - arcPath[0][1];
			for (a=1; a<arcPath.length; a++) {
				basePath.push([arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
			}

		} else {

			// just generate a simple rect

			// this will be a total of 4 points
			// we start with 0,0 as we create the cut path
			basePath.push([0,0]);
			// next the bottom right
			basePath.push([obj.xLen,0]);
			// then the top right
			basePath.push([obj.xLen,obj.yLen]);
			// then the top left
			basePath.push([0,obj.yLen]);

		}

	} else if (obj.type == 'polygon') {
		// a polygon is just a set of points which represent the steps of a climb cut

		// we just push each point to the basePath
		for (var c=0; c<obj.points.length; c++) {

			// except in the case where one of the "points" is an arc
			if (obj.points[c].type == 'arc') {
				// this is an arc
				//console.log('## ARC IN POLYGON AT '+c+'##');

				// the arc must start from the previous point in the object
				// we just generate the arc, then move it to start at the previous point
				arcPath = this.generateArc(obj.points[c]['startDeg'],obj.points[c]['endDeg'],obj.points[c]['r'],this.tool.diameter);

				//console.log(arcPath);

				//console.log('first point in the arcPath is:');
				//console.log(arcPath[0]);
 
				// now we need to get the offset so we can move the arc to the correct place
				// that is done by getting the difference between the previous point
				// and arcPath[0] (first point in arc)
				var xDiff = obj.points[c-1][0] - arcPath[0][0];
				var yDiff = obj.points[c-1][1] - arcPath[0][1];

				//console.log('xDiff = '+xDiff+', yDiff = '+yDiff);

				for (a=1; a<arcPath.length; a++) {
					// add each segment of the arc path to the basePath
					// we don't need the first as there is already a user defined point there so a=1
					//console.log('adding ',[arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
					basePath.push([arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
				}

			} else if (obj.points[c].type == 'cubicBezier') {

				var bez = this.svgLib.cubicBezier(obj.points[c].points);
				for (r in bez) {
					basePath.push(bez[r]);
				}

			} else {
				// just add the point to the path
				//console.log('inserting point '+obj.points[c][0]+','+obj.points[c][1]+' into polygon');
				basePath.push([obj.points[c][0],obj.points[c][1]]);
			}
		}
	} else if (obj.type == 'circle') {

		if (obj.r*2 == this.tool.diameter) {
			// this circle is the exact same size as the tool
			// tools are circles, so the path is just a single point
			basePath = [[0,0]];
		} else {
			// a circle is just an arc with a startDeg of 0 and a totalDeg of 360
			// circles are whole objects, so they can be created with a single this.cut() operation
			basePath = this.generateArc(0,360,obj.r,this.tool.diameter);
		}

	}

	// here we need to offset basePath by startPos
	// this allows users to create objects and move them around
	// JS forces us to cp this to a new array here
	var cp = [];

	// we also collect the min, max and total size of the object here
	// which we will need for pocket operations

	var minX = basePath[0][0];
	var minY = basePath[0][1];
	var maxX = basePath[0][0];
	var maxY = basePath[0][1];
	var total = [];

	// per the inside path generation algorithm we need to ensure that the starting point of the polygon is
	// on the outer bounds of the path, see bug #4 on Github
	var safeStartingPoint = 0;
	var s = '';

	// first offset the polygon by startPos
	for (var c=0; c<basePath.length; c++) {
		basePath[c][0] += startPos[0];
		basePath[c][1] += startPos[1];
	}

	for (var c=0; c<basePath.length; c++) {

		if (basePath[c][0] < minX) {
			minX = basePath[c][0];
			// this will result in the point with the lowest X being a safe starting point
			safeStartingPoint = c;
		} else if (basePath[c][0] > maxX) {
			maxX = basePath[c][0];
		}

		if (basePath[c][1] < minY) {
			minY = basePath[c][1];
			if (basePath[safeStartingPoint][0] == basePath[c][0]) {
				// at this point the safeStartingPoint will have the lowest X and a low Y
				safeStartingPoint = c;
			}
		} else if (basePath[c][1] > maxY) {
			maxY = basePath[c][1];
		}

		cp[c] = [];
		cp[c].push(basePath[c][0]);
		cp[c].push(basePath[c][1]);

	}

	// now we can re-order cp to start from the safeStartingPoint if we need to
	if (safeStartingPoint > 0 && obj.type == 'polygon') {

		//console.log('re-ordering polygon to start from safeStartingPoint #'+safeStartingPoint,cp[safeStartingPoint]);
		// move anything before safeStartingPoint to the end of the path
		var newEnd = cp.slice(0,safeStartingPoint);
		var newStart = cp.slice(safeStartingPoint);
		basePath = [].concat(newStart,newEnd);

	} else {
		basePath = cp;
	}

	total.push(maxX-minX);
	total.push(maxY-minY);

	var smallestAxis = total[0];
	if (total[1] < total[0]) {
		smallestAxis = total[1];
	}

	// check if the last point in the basePath is equal to the first, if not add it
	if (basePath[0][0] == basePath[basePath.length-1][0] && basePath[0][1] == basePath[basePath.length-1][1]) {
		// they both are equal
	} else {
		// add it to the end, this will close the polygon
		basePath.push(basePath[0]);
	}

	//console.log('##basePath##');
	//console.log(basePath);

	var wasReversed = false;
	// to figure out the path direction we can draw an outside offset path then test if any
	// point in the newly created path is inside the original path.
	//
	// if points are inside the original path on an outside path, then the direction is CW
	// which means we will need to temporarily reverse it to
	// generate the correct offset path and apply window/sheet/pane limits to the path

	var testOffset = this.generateOffsetPath('outside',basePath,this.tool.diameter/2);
	var numInside = 0;
	for (var c=0; c<testOffset.length; c++) {
		if (this.pointInPolygon(testOffset[c],basePath)) {
			numInside++;
			if (numInside > Math.floor(testOffset.length/2)) {
				break;
			}
		}
	}

	if (numInside > Math.floor(testOffset.length/2)) {
		// more than half the points are inside the basePath, reverse the path
		wasReversed = true;
		console.log('reversing path to CCW to work with it');
		basePath.reverse();
	}

	// apply any limits to the path
	if (typeof(this.tool.limitX) != 'undefined' && typeof(this.tool.limitY) != 'undefined') {
		basePath = this.applyLimit(0, 0, this.tool.limitX, this.tool.limitY, basePath);
	}

	if (basePath.length == 0) {
		// applyLimit returned no points, meaning there are no points in the path which are inside of the limit
		return;
	}

	for (var c=0; c<basePath.length; c++) {
		// draw the point for testing
		//drawPath([basePath[c]], this.tool, 'centerOnPath', 20, true, c);
	}

	var toolPath = [];
	if (cutType == 'centerOnPath') {
		// just convert the normal path to gcode
		// copy basePath to toolPath
		toolPath = basePath;
	} else if (cutType == 'outside') {
		toolPath = this.generateOffsetPath(cutType,basePath,this.tool.diameter/2);
	} else if (cutType == 'inside') {
		if (obj.type == 'circle' && obj.r*2 == this.tool.diameter) {
			// this is a circle which is the size of the tool, no need to create an offset
			toolPath = basePath;
		} else {
			toolPath = this.generateOffsetPath(cutType,basePath,this.tool.diameter/2);
		}
	} else if (cutType == 'pocket') {
		// this needs to loop over and over until it meets the center
		toolPath = this.generateOffsetPath('inside',basePath,this.tool.diameter/2);
		//console.log('smallestAxis: '+smallestAxis);
		var previousPath = toolPath;

		for (var c=0; c<(smallestAxis-(this.tool.diameter*2))/(this.tool.diameter*this.tool.step); c++) {

			// we use the previous path (which was itself an inside offset) as the next path
			previousPath = this.generateOffsetPath('inside',previousPath,this.tool.diameter*this.tool.step/2);
			if (previousPath != false) {
				// this is a real toolpath, add it
				for (var a=0; a<previousPath.length; a++) {
					// add path to toolpath
					toolPath.push(previousPath[a]);
				}
			}

		}
	}

	var pathDirection = 'ccw';
	if (wasReversed == true) {
		// we need to now set the path and offset path back to their original direction
		basePath.reverse();
		toolPath.reverse();
		console.log('reversing path back to CW');
		pathDirection = 'cw';
	}

	// a climb cut is CCW and a conventional cut is CW
	if (config.useConventionalCut == true && pathDirection == 'ccw') {
		// reverse the CCW cut to have a CW cut
		basePath.reverse();
		toolPath.reverse();
	}

	//console.log('##toolPath##');
	//console.log(toolPath);

	// draw the original path on the html canvas
	drawPath(basePath, this.tool, cutType, depth, true, obj.name);

	//console.log('basePath first point inside mc.cut ',basePath[0]);

	if (cutType != 'centerOnPath') {
		// draw the offset path on the html canvas
		drawPath(toolPath, this.tool, cutType, depth, false, obj.name);
	}

	// now put a comment that explains that the next block of GCODE is for this obj
	this.gcode += '\n; PATH FOR "'+obj.name+'" '+obj.type+' WITH '+cutType+' CUT\n';

	// calculate the number of Z passes
	var numZ = Math.ceil(depth/this.tool.passDepth);

	// comment with Z information
	this.gcode += '; total Z cut depth of '+depth+' with passDepth of '+this.tool.passDepth+' yields '+numZ+' total passes\n';

	// move to zClearance
	this.gcode += '\n; MOVING TO this.tool.zClearance\n';
	this.gcode += 'G0 F'+this.tool.rapid+' Z'+this.tool.zClearance+'\n';

	// move to first point in toolPath
	this.gcode += '; MOVING TO FIRST POINT IN toolPath\n';
	this.gcode += 'G0 F'+this.tool.rapid+' X'+toolPath[0][0]+' Y'+toolPath[0][1]+'\n';

	// now for each Z pass, generate the actual path
	var zPos = 0;
	for (z=1; z<=numZ; z++) {

		// calc Z for this pass
		if (zPos-this.tool.passDepth < -depth) {
			// this is a partial pass which would mean it is the final pass
			// set zPos to -depth
			zPos = -depth;
		} else {
			// this is a full pass, go down another this.tool.passDepth
			zPos = zPos-this.tool.passDepth;
		}
			
		// comment for pass
		this.gcode += '\n; PASS #'+z+' AT '+zPos+' DEPTH\n'; 

		// generate Z movement at this.tool.plunge speed
		this.gcode += 'G1 F'+this.tool.plunge+' Z'+zPos+'\n';

		// loop through each point in the path
		for (c=0; c<toolPath.length; c++) {

			if (c == toolPath.length-1) {
				// this is the last point in the toolPath we can just add it
				// regardless of the current Z
				this.gcode += 'G1 F'+this.tool.cut+' X'+toolPath[c][0]+' Y'+toolPath[c][1]+'\n';

			// now we need to check if this Z layer would need to account for tabs
			// in the event that the tabHeight is greater than tool.passDepth,
			// multiple layers would have to account for tabs
			// numZ is the total number of Z layers
			} else if (this.tool.passDepth*(numZ-z) <= config.tabHeight && config.tabs == true) {
				console.log('creating tabs for Z pass '+z);
				// we need to create the tabs for this layer
				// tabs are only created on straight line sections
				// because it is hard to cut them out of curved sections
				// first we get the total distance of the path
				var d = this.distanceFormula(toolPath[c],toolPath[c+1]);
				if (d >= (config.tabSpacing+config.tabWidth)) {
					// there is space in this line to create tabs
					var numTabs = Math.round(d/(config.tabSpacing+config.tabWidth));
					// if we have a line distance of 100
					// and 3 tabs (width 10) in that line per numTabs
					// then we want to evenly space them
					// so we divide the line distance by numTabs
					var spacePerTab = d/numTabs;
					// which in this example would be 33.33~
					// then in each space per tab we need to center the tab
					// which means dividing the difference of the spacePerTab and tabWidth by 2
					var tabPaddingPerSpace = (spacePerTab-config.tabWidth)/2;

					// now we need to do the point geometry to get the points
					// we start at toolPath[c] which represents the starting point
					// and we end at toolPath[c+1]

					// first we need to get the angle that the whole line is running along
					// get the deltas for X and Y to calculate the line angle with atan2
					var deltaX = toolPath[c+1][0] - toolPath[c][0];
					var deltaY = toolPath[c+1][1] - toolPath[c][1];

					// get the line angle
					var ang = Math.atan2(deltaY,deltaX);
					//console.log('  ANGLE '+ang+' or '+(ang*180/Math.PI));

					// convert it to degrees for later math with addDegree
					ang = ang*180/Math.PI;

					// now that we have the line angle, we can create each of the tabs
					// first we need to add the first point to gcode
					this.gcode += 'G1 F'+this.tool.cut+' X'+toolPath[c][0]+' Y'+toolPath[c][1]+'\n';
					this.gcode += '\n; START TABS\n';
					var npt = toolPath[c];
					for (var r=0; r<numTabs; r++) {
						// then for each tab
						// add another point at the current point +tabPaddingPerSpace
						npt = this.newPointFromDistanceAndAngle(npt,ang,tabPaddingPerSpace);
						this.gcode += 'G1 F'+this.tool.cut+' X'+npt[0]+' Y'+npt[1]+'\n';
						// then we raise the z height by config.tabHeight
						this.gcode += 'G1 Z'+(zPos+config.tabHeight)+'\n';
						// then add another point at the current point +tabWidth
						npt = this.newPointFromDistanceAndAngle(npt,ang,config.tabWidth);
						this.gcode += 'G1 F'+this.tool.cut+' X'+npt[0]+' Y'+npt[1]+'\n';
						// then lower the z height back to zPos at plunge speed
						this.gcode += 'G1 F'+this.tool.plunge+' Z'+zPos+'\n';
						// then add another point at the current point +tabPaddingPerSpace
						// with the cut speed
						npt = this.newPointFromDistanceAndAngle(npt,ang,tabPaddingPerSpace);
						this.gcode += 'G1 F'+this.tool.cut+' X'+npt[0]+' Y'+npt[1]+'\n';
					}
					this.gcode += '; END TABS\n\n';

					//console.log(numTabs+' for a line of '+d+' units with '+spacePerTab+' space per tab and a tabPaddingPerSpace of '+tabPaddingPerSpace);
					//console.log('line angle '+ang);
				} else {
					// line is not long enough, just draw it
					this.gcode += 'G1 F'+this.tool.cut+' X'+toolPath[c][0]+' Y'+toolPath[c][1]+'\n';
				}
			} else {
				// no tabs
				this.gcode += 'G1 F'+this.tool.cut+' X'+toolPath[c][0]+' Y'+toolPath[c][1]+'\n';
			}
		}

	}

	// now move back to zClearance
	this.gcode += '\n; PATH FINISHED FOR "'+obj.name+'" '+obj.type+' WITH '+cutType+' CUT, MOVING BACK TO this.tool.zClearance\n';
	this.gcode += 'G0 F'+this.tool.rapid+' Z'+this.tool.zClearance+'\n';

};

Millcrum.prototype.insert = function(g) {
	// insert gcode directly
	this.gcode += g + '\n';
};

Millcrum.prototype.get = function() {
	// this function returns the finished gcode
	// it is called after the cut operations, so we need to prepend and append some gcode

	var s = '';

	// first list the options
	s = '; TOOL OPTIONS\n';
	for (key in this.tool) {
		s += '; '+key+': '+this.tool[key]+'\n';
	}

	// set units
	s += '\n; SETTING UNITS TO '+this.tool.units+'\n';
	if (this.tool.units == 'mm') {
		s += 'G21\n';
	} else {
		s += 'G20\n';
	}

	// set absolute mode
	s += '\n; SETTING ABSOLUTE POSITIONING\n';
	s += 'G90\n';

	this.gcode = s + this.gcode;

	// returnHome if set
	// this needs to be moved outside of the object and at the end of all objects
	if (this.tool.returnHome == true) {
		this.gcode += '\n; RETURNING TO 0,0,0 BECAUSE this.tool.returnHome IS SET\n';
		this.gcode += 'G0 F'+this.tool.rapid+' X0 Y0 Z0\n';
	}

	//console.log(this.gcode);
	toSaveGcode = this.gcode;

};
