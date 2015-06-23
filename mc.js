var Millcrum = function(tool) {
	this.gcode = '';
	this.debug = false;
	this.tool = tool;

};

Millcrum.prototype.dbg = function() {
	// apply all arguments passed to this.dbg() to v
	// so that console.log() just prints multiple args like normal
	var v = [].slice.apply(arguments);
	if (v.length == 1) {
		v = v[0];
	}
	if (this.debug == true) {
		console.log(v);
	}
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
	// set the surface dimensions
	document.getElementById('surfaceX').value = x;
	document.getElementById('surfaceY').value = y;

	// run the init function
	init();

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

	return oddNodes;

};

//console.log(Millcrum.pointInPolygon([5,5],[[0,0],[10,0],[10,10],[0,10]]));

Millcrum.prototype.linesIntersection = function(l1start,l1end,l2start,l2end) {
	// check if 2 lines intersect and return the point at which they do

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
		result.error = false;
	}

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

	this.dbg('total number of steps '+f+' at '+degreeStep+' degrees which is 360/'+f+' and a distance of '+fDist);

	// now get the number of fragments to actually create, based on the total degrees
	// which is the absolute value of startDeg-endDeg / 360 then multiplied by the total number of fragments
	var totalFrags = (Math.abs(startDeg-endDeg)/360)*f;
	for (var c=1; c<totalFrags; c++) {
		p.push(this.newPointFromDistanceAndAngle([0,0],this.addDegrees(startDeg,c*degreeStep),r));
	}

	return p;

};

Millcrum.prototype.generateOffsetPath = function(type, basePath, offsetDistance) { 
	// generates an offset path from basePath
	// type of either inside or outside
	// offsetDistance determines how far away it is

	this.dbg('##GENERATING OFFSET PATH##');
	this.dbg('');

	// first create an array of midpoints and angles for the offset path
	var newMidpoints = [];
	// we also need to find the line with the longest distance
	longestLine = 0;

	for (var c=1; c<basePath.length; c++) {

		// we are looping through each point starting with 1 instead of 0
		// which means using currentPoint and previousPoint we are looping through
		// each line segment starting with the first

		var currentPoint = basePath[c];
		var previousPoint = basePath[c-1];
		this.dbg('##LINE '+c+' from '+previousPoint[0]+','+previousPoint[1]+' to '+currentPoint[0]+','+currentPoint[1]+'##');

		// get the deltas for X and Y to calculate the line angle with atan2
		var deltaX = currentPoint[0]-previousPoint[0];
		var deltaY = currentPoint[1]-previousPoint[1];

		// get the line angle
		var ang = Math.atan2(deltaY,deltaX);
		this.dbg('  ANGLE '+ang+' or '+(ang*180/Math.PI));

		// convert it to degrees for later math with addDegree
		ang = ang*180/Math.PI;

		// get the length of the line
		var len = this.distanceFormula(currentPoint,previousPoint);
		this.dbg('  LENGTH '+len);

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
		this.dbg('  offsetting '+offsetDistance+' '+type);

		// now split the line at the middle length and get that point
		// then get the coords of the midpoint on the new lines calculated
		// from outsideAng, insideAng and this.tool.diameter (offset)
		// from those midpoints and with the known (perpendicular) line angles you can
		// extend the new lines out

		// get the point coordinate at midpoint of this line
		var midpoint = this.newPointFromDistanceAndAngle(previousPoint,ang,len/2);
		this.dbg('  line midpoint');
		this.dbg(midpoint);

		// now we need the new midpoint for pathAng
		// from midpoint with the this.tool.diameter/2 for a distance
		var movedLineMidPoint = this.newPointFromDistanceAndAngle(midpoint,movedLineAng,offsetDistance);
		this.dbg('  movedLineMidPoint');
		this.dbg(movedLineMidPoint);
		this.dbg('');

		newMidpoints.push([movedLineMidPoint,ang]);

	}

	this.dbg('##newMidpoints##');
	this.dbg(newMidpoints);

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

		this.dbg('  midpoint #'+c);

		// since we have the midpoint, first we have to generate the test lines
		// the current mid point is extended at it's opposite angle
		// and the previous at it's angle
		var currentMidPointEndPoint = this.newPointFromDistanceAndAngle(currentMidPoint[0],this.addDegrees(currentMidPoint[1],180),lenForLine);
		var previousMidPointEndPoint = this.newPointFromDistanceAndAngle(previousMidPoint[0],previousMidPoint[1],lenForLine);

		// now using the 2 lines, we need to find the intersection point of them
		// this will give us a single point which is the START point for the current line and
		// the END point for the previous line
		var iPoint = this.linesIntersection(previousMidPoint[0],previousMidPointEndPoint,currentMidPoint[0],currentMidPointEndPoint);
		this.dbg('  intersection point for current mid point in CW');
		this.dbg(iPoint);

		// if iPoint.error == true here and path is inside, then we can somehow shrink the path
		// but if path is outside there's a problem

		if (iPoint.error == true) {
			// we can exempt this line
		} else {

			// then we can enter that point in the path and it will magically be correct
			// we also round to 8 decimals here
			rPath.push([Math.round(iPoint.x*100000000)/100000000,Math.round(iPoint.y*100000000)/100000000]);

		}

	}

	// then we need to add a point to the end of rPath which goes back to the initial point for rPath
	rPath.push(rPath[0]);

	// now we need to remove points which are outside the bounds of the basePath
	if (type == 'inside') {

		for (var c=0; c<rPath.length-1; c++) {

			if (!this.pointInPolygon(rPath[c],basePath)) {
				// remove this point, it's not within the bound
				this.dbg('removing point from polygon');
				rPath.splice(c,1);
			}

		}

	}

	if (rPath.length == 1) {
		// path not needed
		return false;
	} else {
		// return the newly offset toolpath
		return rPath;
	}

};

Millcrum.prototype.cut = function(cutType, obj, depth, startPos) {

	if (typeof(depth) == 'undefined') {
		// default depth of a cut is the tool defined passDepth
		depth = this.tool.passDepth;
	}

	if (typeof(startPos) == 'undefined') {
		// default start position is X0 Y0
		startPos = [0,0];
	}

	this.dbg('generating cut operation:');
	this.dbg('##tool##');
	this.dbg(this.tool);
	this.dbg('##cutType##');
	this.dbg(cutType);
	this.dbg('##obj.type##');
	this.dbg(obj.type);
	this.dbg('##depth##');
	this.dbg(depth);
	this.dbg('##startPos##');
	this.dbg(startPos);

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
			if (typeof(obj.points[c]['type']) != 'undefined') {
				// this is an arc
				this.dbg('## ARC IN POLYGON AT '+c+'##');

				// the arc must start from the previous point in the object
				// we just generate the arc, then move it to start at the previous point
				arcPath = this.generateArc(obj.points[c]['startDeg'],obj.points[c]['endDeg'],obj.points[c]['r'],this.tool.diameter);

				this.dbg(arcPath);

				this.dbg('first point in the arcPath is:');
				this.dbg(arcPath[0]);
 
				// now we need to get the offset so we can move the arc to the correct place
				// that is done by getting the difference between the previous point
				// and arcPath[0] (first point in arc)
				var xDiff = obj.points[c-1][0] - arcPath[0][0];
				var yDiff = obj.points[c-1][1] - arcPath[0][1];

				this.dbg('xDiff = '+xDiff+', yDiff = '+yDiff);

				for (a=1; a<arcPath.length; a++) {
					// add each segment of the arc path to the basePath
					// we don't need the first as there is already a user defined point there so a=1
					this.dbg('adding ',[arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
					basePath.push([arcPath[a][0]+xDiff,arcPath[a][1]+yDiff]);
				}

			} else {
				// just add the point to the path
				this.dbg('inserting point '+obj.points[c][0]+','+obj.points[c][1]+' into polygon');
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

	// check if the last point in the basePath is equal to the first, if not add it
	if (basePath[0][0] == basePath[basePath.length-1][0] && basePath[0][1] == basePath[basePath.length-1][1]) {
		// they both are equal
	} else {
		// add it to the end
		basePath.push(basePath[0]);
	}

	// here we need to offset basePath by startPos
	// this allows users to create objects and move them around
	// JS forces us to cp this to a new array here
	// we also round to 8 decimal places
	var cp = [];

	// we also collect the min, max and total size of the object here
	// which we will need for pocket operations

	var minX = basePath[0][0];
	var minY = basePath[0][1];
	var maxX = basePath[0][0];
	var maxY = basePath[0][1];
	var total = [];
	for (var c=0; c<basePath.length; c++) {

		if (basePath[c][0] < minX) {
			minX = basePath[c][0];
		} else if (basePath[c][0] > maxX) {
			maxX = basePath[c][0];
		}

		if (basePath[c][1] < minY) {
			minY = basePath[c][1];
		} else if (basePath[c][1] > maxY) {
			maxY = basePath[c][1];
		}

		cp[c] = [];
		// move X
		cp[c].push(Math.round((basePath[c][0]+startPos[0])*100000000)/100000000);
		// move Y
		cp[c].push(Math.round((basePath[c][1]+startPos[1])*100000000)/100000000);
	}
	basePath = cp;
	total.push(maxX-minX);
	total.push(maxY-minY);
	var smallestAxis = total[0];
	if (total[1] < total[0]) {
		smallestAxis = total[1];
	}

	this.dbg('##basePath##');
	this.dbg(basePath);

	drawPath(basePath, this.tool, 'original', depth);

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
		//this.dbg('smallestAxis: '+smallestAxis);
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

	this.dbg('##toolPath##');
	this.dbg(toolPath);

	// send this path to drawPath
	drawPath(toolPath, this.tool, cutType, depth);

	// now put a comment that explains that the next block of GCODE is for this obj
	this.gcode += '\n; PATH FOR '+obj.type+' WITH '+cutType+' CUT\n';

	// calculate the number of Z passes
	var numZ = Math.ceil(depth/this.tool.passDepth);

	// comment with Z information
	this.gcode += '; total Z cut depth of '+depth+' with passDepth of '+this.tool.passDepth+' yields '+numZ+' total passes\n';

	// move to zClearance
	this.gcode += '\n; MOVING TO this.tool.zClearance\n';
	this.gcode += 'G1 F'+this.tool.rapid+' Z'+this.tool.zClearance+'\n';

	// move to first point in toolPath
	this.gcode += '; MOVING TO FIRST POINT IN toolPath\n';
	this.gcode += 'G1 F'+this.tool.rapid+' X'+toolPath[0][0]+' Y'+toolPath[0][1]+'\n';

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

		// set speed to this.tool.cut speed
		this.gcode += 'G1 F'+this.tool.cut+'\n';

		// move to Z
		for (c=1; c<toolPath.length; c++) {
			// generate each straight line
			this.gcode += 'G1 X'+toolPath[c][0]+' Y'+toolPath[c][1]+'\n';
		}

	}

	// now move back to zClearance
	this.gcode += '\n; PATH FINISHED FOR '+obj.type+' WITH '+cutType+' CUT, MOVING BACK TO this.tool.zClearance\n';
	this.gcode += 'G1 F'+this.tool.rapid+' Z'+this.tool.zClearance+'\n';

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
		this.gcode += 'G1 X0 Y0 Z0\n';
	}

	//console.log(this.gcode);
	toSaveGcode = this.gcode;

};
