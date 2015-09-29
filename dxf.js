var Dxf = function() {
	this.layers = [];
	this.polygons = [];
	this.minPoint = [0,0];
	this.maxPoint = [0,0];
	this.width = 0;
	this.height = 0;
};

Dxf.prototype.addDegrees = function(base,mod) {
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

Dxf.prototype.distanceFormula = function(p1,p2) {
        // get the distance between p1 and p2
        var x1 = p1[0];
        var y1 = p1[1];
        var x2 = p2[0];
        var y2 = p2[1];
        var a = (x2-x1)*(x2-x1);
        var b = (y2-y1)*(y2-y1);
        return Math.sqrt(a+b);
};

Dxf.prototype.newPointFromDistanceAndAngle = function(pt,ang,distance) {
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

Dxf.prototype.crossProduct = function(v1,v2) {
	// get the cross product of 2 matrices
	return [(v1[1]*v2[2]) - (v1[2]*v2[1]), (v1[2]*v2[0]) - (v1[0]*v2[2]), (v1[0]*v2[1]) - (v1[1]*v2[0])];
};

Dxf.prototype.calcBulgeCenter = function(p1,p2) {

	var bulge = p1[2];

	var chord = [];
	chord.push(p2[0]-p1[0]);
	chord.push(p2[1]-p1[1]);
	// need to set the Z dimension for crossProduct, default is -1
	chord.push(-1);

	// get the frobenius/euclidean norm of the chord
	// which is the square root of the sum of the absolute squares of the elements
	var chord_length = Math.sqrt((chord[0]*chord[0])+(chord[1]*chord[1]));

	// get the sagitta
	var sagitta = (bulge*chord_length)/2;

	var inc_angle = Math.atan(bulge)*4;
	var radius = (chord_length/2)/Math.sin(inc_angle/2);

	// now we need the cross product of the chord based on a negative or positive bulge
	if (bulge >= 0) {
		var perp = this.crossProduct(chord,[0,0,-1]);

	} else {
		var perp = this.crossProduct(chord,[0,0,1]);
		radius = -radius;
	}

	// get the mid point which is just halving the chord vector (*.5) then adding the p1 vector to that result
	var chord_mid_pt = [(chord[0]*.5)+p1[0], (chord[1]*.5)+p1[1]];

	// get the unit vector which is the perp vector divided by the frobenius/euclidean norm of the perp vector
	var unit_vec = [perp[0]/Math.sqrt((perp[0]*perp[0])+(perp[1]*perp[1])), perp[1]/Math.sqrt((perp[0]*perp[0])+(perp[1]*perp[1]))]

	// and then the arc_center which is: multiply the (radius-sagitta) by the unit_vec then add that to chord_mid_pt
	var c = [((radius-sagitta)*unit_vec[0])+chord_mid_pt[0],((radius-sagitta)*unit_vec[1])+chord_mid_pt[1]];

	return c;

}

Dxf.prototype.parseDxf = function(d) {

	// parse a dxf file (ASCII) which is passed as d

	// first we need to split the file up into newlines
	var l = String(d).split('\n');

	var n = 0, next = false, min_x, min_y, vt_pid_bool = false, cur_pid = 0, acDbPolyline_bool = false, acDbEntity = false, caughtDbEntry = false, cur_acDbEntity = "", caughtX = false, caughtY = false, bulge_bool = false;
	var unusedGroupCodes = [90,70,34,38,39,40,41,210,220,230];
	var skipUnused = true;

	// main loop to parse through the lines
	for (var c = 0; c < l.length; c++) {

		// dxf entity blocks
		if (l[c].match(/ENDBLK/) || l[c].match(/ENDSEC/)) {
			acDbPolyline_bool = false;
			acDbEntity = false;
		} else if (l[c].match(/AcDbEntity/)) {
			if (acDbEntity === true) {
				// if we are getting this again and it's already true, need another
				acDbPolyline_bool = false;
			}
			
			acDbEntity = true;
		} else if (acDbEntity === true && l[c].replace(' ', '') == 8) {
			caughtDbEntry = true;
		} else if (acDbEntity === true && caughtDbEntry === true) {
			caughtDbEntry = false;
			cur_acDbEntity = l[c];

		// polygon
		} else if (cur_acDbEntity != '' && l[c].match(/AcDbPolyline/)) {

			acDbPolyline_bool = true;
			// add a polygon
			this.polygons.push({layer: cur_acDbEntity.trim(), points: []});
		} else if (acDbPolyline_bool === true && unusedGroupCodes.indexOf(Number(l[c])) > -1) {
			// this is an unused group code, we can disregard this and the next line
			skipUnused = true;
		} else if (acDbPolyline_bool === true && skipUnused === true) {
			skipUnused = false;
		} else if (acDbPolyline_bool === true && l[c].replace(' ', '') == 10) {
			caughtX = true;
		} else if (acDbPolyline_bool === true && caughtX === true) {

			caughtX = false;
			// got the first X coordinate of this XY pair, add it to points
			this.polygons[this.polygons.length - 1].points.push([Number(l[c])]);

		} else if (acDbPolyline_bool === true && l[c].replace(' ', '') == 20) {
			caughtY = true;
		} else if (acDbPolyline_bool === true && caughtY === true) {
			caughtY = false;
			if (this.polygons[this.polygons.length - 1].points.length) {
				// got the Y coordinate for this XY pair
				this.polygons[this.polygons.length - 1].points[this.polygons[this.polygons.length - 1].points.length - 1].push(Number(l[c]));
			}
		} else if (acDbPolyline_bool === true && l[c].replace(' ', '') == 42) {
			// this vertex has a bulge
			bulge_bool = true;
		} else if (acDbPolyline_bool === true && bulge_bool === true) {
			// add bulge as third item in points array
			if (this.polygons[this.polygons.length - 1].points.length) {
				this.polygons[this.polygons.length - 1].points[this.polygons[this.polygons.length - 1].points.length - 1].push(Number(l[c]));
			}
			bulge_bool = false;
		} else if (acDbPolyline_bool === true && l[c].match(/ENDBLK/)) {
			// reset the indicators for polyline entity
			acDbPolyline_bool = false;
			acDbEntity = false;

		// ENDBLK
		} else if (l[c].match(/ENDBLK/)) {
			acDbEntity = false;
		}

	}

	// init min and this.maxPoint with the first values in the first polygon
	this.minPoint[0] = this.polygons[0].points[0][0];
	this.minPoint[1] = this.polygons[0].points[0][1];
	this.maxPoint[0] = this.polygons[0].points[0][0];
	this.maxPoint[1] = this.polygons[0].points[0][1];

	// now we loop through the polygons
	for (var c=0; c<this.polygons.length; c++) {
		var polygon = this.polygons[c];

		//console.log('\n\n\n\nLAYER',polygon.layer);
		//console.log('POINTS BEFORE PROCESSING',polygon.points.length);

		// loop through each point in polygon for the min and max values
		for (var i=0; i<polygon.points.length-1; i++) {
			var p1 = polygon.points[i];

			// for x
			if (p1[0] > this.maxPoint[0]) {
				this.maxPoint[0] = p1[0];
			} else if (p1[0] < this.minPoint[0]) {
				this.minPoint[0] = p1[0];
			}

			// for y
			if (p1[1] > this.maxPoint[1]) {
				this.maxPoint[1] = p1[1];
			} else if (p1[1] < this.minPoint[1]) {
				this.minPoint[1] = p1[1];
			}

		}

		// loop through each point in polygon again to calculate the bulges
		var newPoints = [];

		for (var i=0; i<polygon.points.length-1; i++) {
			var p1 = polygon.points[i];
			var p2 = polygon.points[i+1];

			// temp for displaying points later
			var thisLoopPoints = [];

			/*
			console.log('\nPOINT LOOP #'+i+' for '+polygon.layer);
			console.log('p1',p1);
			console.log('p2',p2);
			console.log('cv',cv);
			*/

			if (p1[0] == p2[0] && p1[1] == p2[1]) {
				// the points are the exact same

			} else {
				// the points are different

				if (typeof(p1[2]) != 'undefined') {
					// there is a bulge, get the center point
					var cv = this.calcBulgeCenter(p1, p2);

					if (false) {
						// the bulge point are on the same line, stupid editor
						// just add the points
						newPoints.push(p1,p2);
					} else {
						// this is a proper bulge point, calculate it

						// radius between p1 and cv
						var r = this.distanceFormula(p1, cv);
						var startPointQuad = 0;
						var endPointQuad = 0;
						var startAng = 0;
						var endAng = 0;

						//
						//   2   |   1
						//       |
						// ------|-------
						//       |
						//   3   |   4
						//
						// first find start point quadrant relative to cv
						// and end point quadrant relative to cv

						// start point
						if (p1[0] > cv[0] && p1[1] > cv[1]) {
							startPointQuad = 1;
						} else if (p1[0] < cv[0] && p1[1] > cv[1]) {
							startPointQuad = 2;
						} else if (p1[0] < cv[0] && p1[1] < cv[1]) {
							startPointQuad = 3;
						} else if (p1[0] > cv[0] && p1[1] < cv[1]) {
							startPointQuad = 4;
						}

						// end point
						if (p2[0] > cv[0] && p2[1] > cv[1]) {
							endPointQuad = 1;
						} else if (p2[0] < cv[0] && p2[1] > cv[1]) {
							endPointQuad = 2;
						} else if (p2[0] < cv[0] && p2[1] < cv[1]) {
							endPointQuad = 3;
						} else if (p2[0] > cv[0] && p2[1] < cv[1]) {
							endPointQuad = 4;
						}

						// start angle from cv to p1
						var startSlope = (cv[1] - p1[1]) / (cv[0] - p1[0]);
						var startAng = 180 * Math.atan(startSlope) / Math.PI;
						if (p1[2] >= 0) {
							// positive bulge
							if (startPointQuad == 2) {
								startAng = 180 + startAng;
							} else if (startPointQuad == 3) {
								startAng = 180 + startAng;
							} else if (startPointQuad == 4) {
								startAng = 360 + startAng;
							}
						} else {
							// negative bulge
							if (startPointQuad == 2) {
								startAng = 180 + startAng;
							} else if (startPointQuad == 3) {
								startAng = 180 + startAng;
							} else if (startPointQuad == 4) {
								startAng = 360 + startAng;
							}
						}

						// end angle from cv to p2
						var endSlope = (cv[1] - p2[1]) / (cv[0] - p2[0]);
						var endAng = 180 * Math.atan(endSlope) / Math.PI;
						if (p1[2] < 0) {
							// negative bulge
							if (endPointQuad == 2) {
								endAng = 180 + endAng;
							} else if (endPointQuad == 3) {
								endAng = 180 + endAng;
							} else if (endPointQuad == 4) {
								endAng = 360 + endAng;
							}
						} else {
							// positive bulge
							if (endPointQuad == 2) {
								endAng = 180 + endAng;
							} else if (endPointQuad == 3) {
								endAng = 180 + endAng;
							} else if (endPointQuad == 4) {
								endAng = 360 + endAng;
							}
						}

						if (p1[2] < 0) {
							// this is a negative bulge so it will be an arc that goes from p1 to p2 except
							// it will be bulging toward the cv point and not away from it like normal
							var arcTotalDeg = 360 - this.addDegrees(endAng, -startAng);
						} else {
							var arcTotalDeg = this.addDegrees(endAng, -startAng);
						}

						// now we need to create the line segments in the arc
						var numSegments = 40;
						var degreeStep = arcTotalDeg / numSegments;

						// now loop through each degreeStep
						for (var a=1; a<numSegments+1; a++) {
							// for a positive bulge the start point is always a lower number of degrees
							if (p1[2] < 0) {
								// for a negative bulge we need to subtract degreeStep
								var pt = this.newPointFromDistanceAndAngle(cv, this.addDegrees(startAng, -(degreeStep * a)), r);
							} else {
								// for a positive bulge we add degreeStep
								var pt = this.newPointFromDistanceAndAngle(cv, this.addDegrees(startAng, (degreeStep * a)), r);
							}
							// add the point
							newPoints.push(pt);
							thisLoopPoints.push(pt);
						}

						p1 = thisLoopPoints[0];
						p2 = thisLoopPoints[thisLoopPoints.length-1];

					}


				} else {
					// line segment without bulge, add it
					newPoints.push(p1,p2);
				}

			}

/*
			console.log('startAng',startAng);
			console.log('endAng',endAng);
			console.log('startPointQuad',startPointQuad);
			console.log('endPointQuad',endPointQuad);
			console.log('thisLoopPoints ' + thisLoopPoints.length);
*/

/*
			for (var nn=0; nn<thisLoopPoints.length; nn++) {
				console.log(nn,thisLoopPoints[nn]);
			}
*/

			//console.log('POINT LOOP #'+i+' '+thisLoopPoints.length,p1,p2);

		}

		// set newPoints as this polygons points
		this.polygons[c].points = newPoints;

		//console.log('POINTS AFTER PROCESSING',newPoints.length);

	}

	// set width and height
	this.width = this.maxPoint[0] - this.minPoint[0];
	this.height = this.maxPoint[1] - this.minPoint[1];

};

/*
var fs = require('fs');

var dxf = new Dxf();

fs.readFile('../oshw.dxf', function(e, d) {
	dxf.parseDxf(d);
	var s = 'var tool = {units:"mm",diameter:6.35,passDepth:4,step:1,rapid:2000,plunge:100,cut:600,zClearance:5,returnHome:true};\n';

	s += '// setup a new Millcrum object with that tool\nvar mc = new Millcrum(tool);\n';
	s += '// set the surface dimensions for the viewer\nmc.surface('+(dxf.width*1.5)+','+(dxf.height*1.5)+');\n';

	for (var c=0; c<dxf.polygons.length; c++) {
		var wtf = dxf.polygons[c].layer;
		s += '\n//LAYER '+wtf+'\n';
		s += 'var polygon'+c+' = {type:\'polygon\',name:\''+wtf+'\',points:[';
		for (var p=0; p<dxf.polygons[c].points.length; p++) {
			s += '['+dxf.polygons[c].points[p][0]+','+dxf.polygons[c].points[p][1]+'],';
		}

		s += ']};\nmc.cut(\'centerOnPath\', polygon'+c+', 4, [0,0]);\n';
	}

	s += '\nmc.get();\n';
	console.log(s);

});
*/
